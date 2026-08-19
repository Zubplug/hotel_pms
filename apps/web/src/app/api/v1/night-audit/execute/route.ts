import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    // Basic permission check (in a real app, require specific NIGHT_AUDIT permission)
    const canRun = await hasPermission(session.user.id, 'housekeeping', 'create', propertyId);
    if (!canRun) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = getPropertyBusinessDate(property.timezone, new Date());
    const nextBusinessDate = getNextBusinessDate(businessDate);

    // 1. Idempotently initialize the Night Audit Run for this businessDate
    // Use upsert to handle race conditions if multiple people click it at the exact same millisecond
    const auditRun = await prisma.nightAudit.upsert({
      where: { propertyId_businessDate: { propertyId, businessDate } },
      update: {},
      create: {
        propertyId,
        businessDate,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        runBy: session.user.id
      }
    });

    if (auditRun.status === 'COMPLETED') {
      return errorResponse('CONFLICT', `Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`, 409);
    }

    if (auditRun.status === 'IN_PROGRESS' && auditRun.runBy !== session.user.id && auditRun.createdAt < new Date(Date.now() - 3600000)) {
      // Allow taking over if it's been stuck for over an hour, otherwise block
      // Simplification for Phase 8B: just let the engine process it idempotently
    }

    // 2. Write System Audit Log for Started
    await prisma.auditLog.create({
      data: {
        organizationId: property.organizationId,
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: (session.user as any).role || 'SYSTEM',
        action: 'NIGHT_AUDIT_STARTED',
        resource: 'NightAudit',
        resourceId: auditRun.id,
        newValue: { businessDate },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'SYSTEM',
        requestId: crypto.randomUUID(),
      }
    });

    // 3. Find Eligible Stayover Reservations
    // Requirements: CHECKED_IN and checkOut > nextBusinessDate
    const eligibleReservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        checkOut: { gt: nextBusinessDate }
      },
      include: {
        priorities: true,
        reservationRooms: {
          include: { room: true }
        }
      }
    });

    let totalTasksCreated = 0;
    let totalTasksSkipped = 0;
    let errors = 0;

    // 4. Batch Processing
    for (let i = 0; i < eligibleReservations.length; i += BATCH_SIZE) {
      const batch = eligibleReservations.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (reservation) => {
        for (const rr of reservation.reservationRooms) {
          const room = rr.room;
          if (!room) continue;

          try {
            await prisma.$transaction(async (tx) => {
              const idempotencyKey = `STAYOVER_${reservation.id}_${room.id}_${nextBusinessDate.toISOString().split('T')[0]}`;
              
              const existingTask = await tx.housekeepingTask.findUnique({
                where: { idempotencyKey }
              });

              if (existingTask) {
                totalTasksSkipped++;
                return; // Idempotent skip
              }

              let taskPriority = 'NORMAL';
              if (reservation.priorities && reservation.priorities.length > 0) {
                for (const p of reservation.priorities) {
                  if (p.type === 'VIP' || p.type === 'MANAGEMENT') {
                    taskPriority = 'CRITICAL';
                    break;
                  } else if (p.type === 'BACK_TO_BACK') {
                    if (taskPriority !== 'CRITICAL') taskPriority = 'HIGH';
                  }
                }
              }

              // Create the task
              const task = await tx.housekeepingTask.create({
                data: {
                  idempotencyKey,
                  propertyId,
                  roomId: room.id,
                  type: 'STAYOVER',
                  priority: taskPriority,
                  status: 'PENDING',
                  businessDate: nextBusinessDate,
                  notes: 'Auto-generated via Night Audit'
                }
              });

              // Update Room Status independently (status remains OCCUPIED)
              await tx.room.update({
                where: { id: room.id },
                data: { housekeepingStatus: 'PENDING' }
              });

              // Write detailed audit log
              await tx.auditLog.create({
                data: {
                  organizationId: property.organizationId,
                  propertyId,
                  userId: session.user.id, // Or SYSTEM ID
                  userEmail: session.user.email,
                  userRole: 'SYSTEM',
                  action: 'STAYOVER_TASK_CREATED',
                  resource: 'HousekeepingTask',
                  resourceId: task.id,
                  newValue: { reservationId: reservation.id, roomId: room.id },
                  ipAddress: '127.0.0.1',
                  userAgent: 'LodgeCore Night Audit Engine',
                  requestId: crypto.randomUUID(),
                }
              });
              
              totalTasksCreated++;
            });
          } catch (e) {
            console.error(`[Night Audit] Failed to process stayover for room ${room.id}:`, e);
            errors++;
          }
        }
      }));
    }

    // 5. Update Night Audit Counters and Finalize
    const completedAudit = await prisma.nightAudit.update({
      where: { id: auditRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tasksCreated: { increment: totalTasksCreated },
        tasksSkipped: { increment: totalTasksSkipped },
        errors: { increment: errors }
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: property.organizationId,
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: 'SYSTEM',
        action: 'NIGHT_AUDIT_COMPLETED',
        resource: 'NightAudit',
        resourceId: auditRun.id,
        newValue: { tasksCreated: totalTasksCreated, tasksSkipped: totalTasksSkipped, errors },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: 'SYSTEM',
        requestId: crypto.randomUUID(),
      }
    });

    if (errors > 0) {
      await NotificationEngine.emit({
        type: 'NIGHT_AUDIT_DISCREPANCY',
        organizationId: property.organizationId,
        propertyId,
        entityType: 'night_audit',
        entityId: completedAudit.id,
        idempotencyKey: `night_audit_${completedAudit.id}_discrepancy`,
        metadata: { errors }
      });
    } else {
      await NotificationEngine.emit({
        type: 'NIGHT_AUDIT_COMPLETED',
        organizationId: property.organizationId,
        propertyId,
        entityType: 'night_audit',
        entityId: completedAudit.id,
        idempotencyKey: `night_audit_${completedAudit.id}_success`,
        metadata: { tasksCreated: totalTasksCreated }
      });
    }

    return successResponse({
      message: 'Night Audit successfully executed.',
      auditId: completedAudit.id,
      tasksCreated: totalTasksCreated,
      tasksSkipped: totalTasksSkipped,
      errors
    });

  } catch (err: any) {
    console.error('[Night Audit POST]', err);
    
    // We attempt to emit the failure, but we may not have propertyId if it failed early.
    // If it's a severe crash, we emit NIGHT_AUDIT_FAILED if possible.
    try {
      const reqBody = await req.clone().json().catch(() => ({}));
      if (reqBody.propertyId) {
        // Need to fetch property to get organizationId to emit properly
        const prop = await prisma.property.findUnique({ where: { id: reqBody.propertyId } });
        if (prop) {
           await NotificationEngine.emit({
             type: 'NIGHT_AUDIT_FAILED',
             organizationId: prop.organizationId,
             propertyId: prop.id,
             entityType: 'night_audit',
             entityId: 'failed_run',
             idempotencyKey: `night_audit_fail_${prop.id}_${new Date().toISOString().split('T')[0]}`,
             metadata: { error: err.message }
           });
        }
      }
    } catch (e) {
       console.error('[Night Audit POST] Failed to emit failure notification', e);
    }

    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

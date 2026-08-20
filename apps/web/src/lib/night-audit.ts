import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';

const BATCH_SIZE = 50;

export async function executeNightAudit(propertyId: string, userId: string, userEmail: string | null | undefined, userRole: string = 'SYSTEM', reqIp: string = '127.0.0.1', reqUserAgent: string = 'SYSTEM') {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });
  
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const businessDate = getPropertyBusinessDate(property.timezone, new Date());
  const nextBusinessDate = getNextBusinessDate(businessDate);

  // 1. Idempotently initialize the Night Audit Run for this businessDate
  const auditRun = await prisma.nightAudit.upsert({
    where: { propertyId_businessDate: { propertyId, businessDate } },
    update: {},
    create: {
      propertyId,
      businessDate,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      runBy: userId
    }
  });

  if (auditRun.status === 'COMPLETED') {
    throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`);
  }

  // 2. Write System Audit Log for Started
  await prisma.auditLog.create({
    data: {
      organizationId: property.organizationId,
      propertyId,
      userId,
      userEmail: userEmail || 'unknown@system.local',
      userRole,
      action: 'NIGHT_AUDIT_STARTED',
      resource: 'NightAudit',
      resourceId: auditRun.id,
      newValue: { businessDate },
      ipAddress: reqIp,
      userAgent: reqUserAgent,
      requestId: crypto.randomUUID(),
    }
  });

  // 3. Find Eligible Stayover Reservations
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
                userId,
                userEmail: userEmail || 'unknown@system.local',
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
      userId,
      userEmail: userEmail || 'unknown@system.local',
      userRole: 'SYSTEM',
      action: 'NIGHT_AUDIT_COMPLETED',
      resource: 'NightAudit',
      resourceId: auditRun.id,
      newValue: { tasksCreated: totalTasksCreated, tasksSkipped: totalTasksSkipped, errors },
      ipAddress: reqIp,
      userAgent: reqUserAgent,
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

  return {
    auditId: completedAudit.id,
    tasksCreated: totalTasksCreated,
    tasksSkipped: totalTasksSkipped,
    errors
  };
}

export async function getNightAuditPreview(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }});
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const businessDate = getPropertyBusinessDate(property.timezone, new Date());
  const nextBusinessDate = getNextBusinessDate(businessDate);

  const currentAudit = await prisma.nightAudit.findUnique({
    where: { propertyId_businessDate: { propertyId, businessDate } }
  });

  const projectedStayovers = await prisma.reservation.count({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      checkOut: { gt: nextBusinessDate }
    }
  });

  const pendingArrivals = await prisma.reservation.count({
    where: {
      propertyId,
      status: 'CONFIRMED',
      checkIn: businessDate
    }
  });
  
  const unresolvedFolios = await prisma.folio.count({
    where: {
      propertyId,
      status: 'OPEN',
      balance: { not: 0 }
    }
  });

  const openApprovals = await prisma.approvalRequest.count({
    where: {
      propertyId,
      status: 'PENDING'
    }
  });

  return {
    timezone: property.timezone,
    businessDate,
    nextBusinessDate,
    audit: currentAudit || null,
    projectedStayovers,
    pendingArrivals,
    unresolvedFolios,
    openApprovals,
    warnings: pendingArrivals > 0 ? ['There are still pending arrivals for today.'] : []
  };
}

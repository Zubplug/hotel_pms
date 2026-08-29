import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';

const BATCH_SIZE = 50;

const FINANCIAL_EVENT_TYPES = new Set([
  'POST_PAYMENT',
  'PAYMENT',
  'ADVANCE_DEPOSIT',
  'ADVANCE_DEPOSIT_REQUEST',
  'POST_CHARGE',
  'ROOM_CHARGE',
  'ROOM_CREDIT',
  'CREDIT_ADJUSTMENT_REQUEST',
  'REFUND_REQUESTED',
  'REFUND',
  'POS_PAYMENT',
  'POS_ORDER'
]);

function classifySyncConflict(conflict: { aggregateType: string; hotelEvent: { eventType: string } }) {
  const eventType = conflict.hotelEvent.eventType.toUpperCase();
  const aggregateType = conflict.aggregateType.toUpperCase();

  if (
    FINANCIAL_EVENT_TYPES.has(eventType) ||
    eventType.includes('PAYMENT') ||
    eventType.includes('CHARGE') ||
    eventType.includes('REFUND') ||
    eventType.includes('DEPOSIT') ||
    eventType.includes('CREDIT') ||
    aggregateType === 'FOLIO' ||
    aggregateType === 'POS_ORDER'
  ) {
    return 'FINANCIAL';
  }

  if (eventType === 'CHECK_IN' || eventType === 'CHECK_OUT' || aggregateType === 'RESERVATION') {
    return 'REVIEW';
  }

  return 'OPERATIONAL';
}

export async function getNightAuditConflictSummary(propertyId: string) {
  const conflicts = await prisma.syncConflict.findMany({
    where: { propertyId, status: 'PENDING' },
    select: {
      aggregateType: true,
      hotelEvent: { select: { eventType: true } }
    }
  });

  return conflicts.reduce(
    (summary, conflict) => {
      summary.total += 1;
      summary[classifySyncConflict(conflict).toLowerCase() as 'financial' | 'review' | 'operational'] += 1;
      return summary;
    },
    { total: 0, financial: 0, review: 0, operational: 0 }
  );
}

export async function executeNightAudit(propertyId: string, userId: string | null, userEmail: string | null | undefined, userRole: string = 'SYSTEM', reqIp: string = '127.0.0.1', reqUserAgent: string = 'SYSTEM') {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });
  
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());
  const nextBusinessDate = getNextBusinessDate(businessDate);

  const existingAudit = await prisma.nightAudit.findUnique({
    where: { propertyId_businessDate: { propertyId, businessDate } }
  });

  if (existingAudit?.status === 'COMPLETED') {
    throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`);
  }

  if (existingAudit?.status === 'IN_PROGRESS') {
    throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} is already in progress.`);
  }

  const [openSessions, conflictSummary] = await Promise.all([
    prisma.posSession.count({
      where: {
        propertyId,
        businessDate,
        status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] }
      }
    }),
    getNightAuditConflictSummary(propertyId)
  ]);

  if (openSessions > 0) {
    throw new Error(`POS_CONFLICTS_EXIST:Night Audit blocked: ${openSessions} open POS session(s) must be closed or reconciled first. Pending sync conflicts do not block rollover and remain queued for review.`);
  }

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
    
    await Promise.all(batch.map(async (reservation: any) => {
      for (const rr of reservation.reservationRooms) {
        const room = rr.room;
        if (!room) continue;

        try {
          await prisma.$transaction(async (tx: any) => {
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
                status: 'CLEANING',
                businessDate: nextBusinessDate,
                notes: 'Auto-generated via Night Audit'
              }
            });

            // Update Room Status independently (status remains OCCUPIED)
            await tx.room.update({
              where: { id: room.id },
              data: { housekeepingStatus: 'CLEANING' }
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
  const exceptions = {
    pendingSyncConflicts: conflictSummary.total,
    financialSyncConflicts: conflictSummary.financial,
    reviewSyncConflicts: conflictSummary.review,
    operationalSyncConflicts: conflictSummary.operational,
    stayoverTaskErrors: errors,
    rolloverCompleted: true
  };

  const completedAudit = await prisma.nightAudit.update({
    where: { id: auditRun.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      tasksCreated: { increment: totalTasksCreated },
      tasksSkipped: { increment: totalTasksSkipped },
      errors: { increment: errors },
      exceptions
    }
  });

  const dateRollover = await prisma.property.updateMany({
    where: { id: propertyId, businessDate },
    data: {
      businessDate: nextBusinessDate,
      lastAuditAt: new Date(),
      auditStatus: errors > 0 || conflictSummary.total > 0
        ? 'COMPLETED_WITH_EXCEPTIONS'
        : 'COMPLETED'
    }
  });

  if (dateRollover.count !== 1) {
    throw new Error('CONFLICT:Business date changed while Night Audit was running.');
  }

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
      newValue: { tasksCreated: totalTasksCreated, tasksSkipped: totalTasksSkipped, errors, exceptions },
      ipAddress: reqIp,
      userAgent: reqUserAgent,
      requestId: crypto.randomUUID(),
    }
  });

  if (errors > 0 || conflictSummary.total > 0) {
    await NotificationEngine.emit({
      type: 'NIGHT_AUDIT_DISCREPANCY',
      organizationId: property.organizationId,
      propertyId,
      entityType: 'night_audit',
      entityId: completedAudit.id,
      idempotencyKey: `night_audit_${completedAudit.id}_discrepancy`,
      metadata: { errors, ...conflictSummary }
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
    errors,
    conflicts: conflictSummary
  };
}

export async function getNightAuditPreview(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }});
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());
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

  const pendingSyncConflicts = await getNightAuditConflictSummary(propertyId);

  const warnings = [] as string[];
  if (pendingArrivals > 0) warnings.push('There are still pending arrivals for today.');
  if (pendingSyncConflicts.total > 0) {
    warnings.push(`${pendingSyncConflicts.total} sync conflict(s) will remain visible for review after rollover.`);
  }

  return {
    timezone: property.timezone,
    businessDate,
    nextBusinessDate,
    audit: currentAudit || null,
    projectedStayovers,
    pendingArrivals,
    unresolvedFolios,
    openApprovals,
    pendingSyncConflicts,
    warnings
  };
}

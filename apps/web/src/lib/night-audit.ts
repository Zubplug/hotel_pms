import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';
import { getSystemIntegrity } from './night-audit-service';

const BATCH_SIZE = 50;

import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation } from './night-audit-service';

export async function getNightAuditPreview(propertyId: string) {
  const [operational, system, financial, cash] = await Promise.all([
    getOperationalReview(propertyId),
    getSystemIntegrity(propertyId),
    getFinancialAudit(propertyId),
    getCashReconciliation(propertyId)
  ]);

  let blockers = 0;
  let warnings = 0;

  if (operational.arrivals.length > 0) warnings++;
  if (operational.departures.length > 0) warnings++;
  if (operational.roomReconciliation.some((r: any) => r.issue)) warnings++;

  if (system.openPosSessions.length > 0) blockers++;
  if (system.financialSyncConflicts.length > 0) blockers++;
  if (system.hardwareAgents.some((a: any) => a.status === 'OFFLINE')) warnings++;

  if (financial.highBalances.length > 0) warnings++;

  return {
    operational,
    system,
    financial,
    cash,
    summary: { blockers, warnings }
  };
}

export async function executeNightAudit(
  propertyId: string, 
  userId: string | null, 
  userEmail: string | null | undefined, 
  userRole: string = 'SYSTEM', 
  reqIp: string = '127.0.0.1', 
  reqUserAgent: string = 'SYSTEM'
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });
  
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());
  const nextBusinessDate = getNextBusinessDate(businessDate);

  // 1. Enforce Blocking Conditions
  const { openPosSessions, financialSyncConflicts } = await getSystemIntegrity(propertyId);
  
  if (openPosSessions.length > 0) {
    throw new Error('BLOCKER:Cannot execute audit. There are open POS sessions.');
  }

  if (financialSyncConflicts.length > 0) {
    throw new Error('BLOCKER:Cannot execute audit. There are unresolved financial sync conflicts.');
  }

  // 2. Lock & Initialize Run (Idempotency)
  // Generating a deterministic runReference for the day so multiple clicks don't create multiple runs
  const runReference = `NA-${propertyId}-${businessDate.toISOString().split('T')[0]}`;
  
  const auditRun = await prisma.nightAudit.upsert({
    where: { propertyId_businessDate: { propertyId, businessDate } },
    update: {
      status: 'IN_PROGRESS',
      runBy: userId,
    },
    create: {
      propertyId,
      businessDate,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      runBy: userId,
      runReference
    }
  });

  if (auditRun.status === 'COMPLETED') {
    throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`);
  }

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
      newValue: { businessDate, runReference },
      ipAddress: reqIp,
      userAgent: reqUserAgent,
      requestId: crypto.randomUUID(),
    }
  });

  // 3. Post Room Charges
  const eligibleReservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      checkOut: { gt: nextBusinessDate }
    },
    include: {
      priorities: true,
      reservationRooms: { include: { room: true } },
      folios: { where: { type: 'MAIN', status: 'OPEN' } },
      ratePlan: true
    }
  });

  let totalTasksCreated = 0;
  let totalTasksSkipped = 0;
  let totalRoomChargesPosted = 0;
  let errors = 0;

  for (let i = 0; i < eligibleReservations.length; i += BATCH_SIZE) {
    const batch = eligibleReservations.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (reservation: any) => {
      try {
        await prisma.$transaction(async (tx: any) => {
          
          // Post Room Charge Idempotently
          if (reservation.folios && reservation.folios.length > 0) {
            const mainFolio = reservation.folios[0];
            const chargeIdempotencyKey = `ROOM_CHARGE_${reservation.id}_${businessDate.toISOString().split('T')[0]}`;
            
            // Check if we already posted it in this run
            const existingCharge = await tx.folioItem.findFirst({
              where: {
                folioId: mainFolio.id,
                source: 'ROOM',
                businessDate,
                nightAuditRunId: auditRun.id
              }
            });

            if (!existingCharge) {
              const baseRate = reservation.ratePlan?.baseRate || 0;
              await tx.folioItem.create({
                data: {
                  folioId: mainFolio.id,
                  businessDate,
                  type: 'CHARGE',
                  source: 'ROOM',
                  description: `Room Charge for ${businessDate.toISOString().split('T')[0]}`,
                  quantity: 1,
                  unitAmount: baseRate,
                  amount: baseRate,
                  baseAmount: baseRate,
                  currency: property.supportedCurrencies[0] || 'NGN',
                  postedBy: userId || 'SYSTEM',
                  nightAuditRunId: auditRun.id
                }
              });

              // Update folio balance
              await tx.folio.update({
                where: { id: mainFolio.id },
                data: { balance: { increment: baseRate } }
              });
              
              totalRoomChargesPosted++;
            }
          }

          // Generate Housekeeping Tasks Idempotently
          for (const rr of reservation.reservationRooms) {
            const room = rr.room;
            if (!room) continue;

            const hkIdempotencyKey = `STAYOVER_${reservation.id}_${room.id}_${nextBusinessDate.toISOString().split('T')[0]}`;
            
            const existingTask = await tx.housekeepingTask.findUnique({
              where: { idempotencyKey: hkIdempotencyKey }
            });

            if (existingTask) {
              totalTasksSkipped++;
              continue; 
            }

            let taskPriority = 'NORMAL';
            if (reservation.priorities && reservation.priorities.some((p: any) => p.type === 'VIP')) {
              taskPriority = 'CRITICAL';
            }

            await tx.housekeepingTask.create({
              data: {
                idempotencyKey: hkIdempotencyKey,
                propertyId,
                roomId: room.id,
                type: 'STAYOVER',
                priority: taskPriority,
                status: 'CLEANING',
                businessDate: nextBusinessDate,
                notes: 'Auto-generated via Night Audit'
              }
            });

            await tx.room.update({
              where: { id: room.id },
              data: { housekeepingStatus: 'CLEANING' }
            });
            
            totalTasksCreated++;
          }
        });
      } catch (e) {
        console.error(`[Night Audit] Failed to process stayover for reservation ${reservation.id}:`, e);
        errors++;
      }
    }));
  }

  // 4. Update Night Audit Status and Roll Date
  const completedAudit = await prisma.nightAudit.update({
    where: { id: auditRun.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      tasksCreated: { increment: totalTasksCreated },
      tasksSkipped: { increment: totalTasksSkipped },
      roomChargesPosted: { increment: totalRoomChargesPosted },
      errors: { increment: errors },
    }
  });

  const dateRollover = await prisma.property.updateMany({
    where: { id: propertyId, businessDate },
    data: {
      businessDate: nextBusinessDate,
      lastAuditAt: new Date(),
      auditStatus: errors > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED'
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
      newValue: { tasksCreated: totalTasksCreated, chargesPosted: totalRoomChargesPosted },
      ipAddress: reqIp,
      userAgent: reqUserAgent,
      requestId: crypto.randomUUID(),
    }
  });

  return {
    auditId: completedAudit.id,
    tasksCreated: totalTasksCreated,
    tasksSkipped: totalTasksSkipped,
    roomChargesPosted: totalRoomChargesPosted,
    errors
  };
}

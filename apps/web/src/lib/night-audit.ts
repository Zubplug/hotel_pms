import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';
import { applyAvailableFolioCredit } from '@/lib/finance/apply-folio-credit';

const BATCH_SIZE = 50;

import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation } from './night-audit-service';

export async function getNightAuditPreview(ctx: any, propertyId: string) {
  const [operational, system, financial, cash] = await Promise.all([
    getOperationalReview(ctx, propertyId),
    getSystemIntegrity(ctx, propertyId),
    getFinancialAudit(ctx, propertyId),
    getCashReconciliation(ctx, propertyId)
  ]);

  let blockers = 0;
  let warnings = 0;

  if (operational.arrivals.length > 0) warnings++;
  if (operational.departures.length > 0) warnings++;
  if (operational.roomReconciliation.some((r: any) => r.issue)) warnings++;

  if (system.openPosSessions.length > 0) blockers++;
  if (system.openFrontdeskSessions.length > 0) blockers++;
  if (system.financialSyncConflicts.length > 0) blockers++;

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
  ctx: any,
  propertyId: string, 
  userId: string | null, 
  userEmail: string | null | undefined, 
  userRole: string = 'SYSTEM', 
  reqIp: string = '127.0.0.1', 
  reqUserAgent: string = 'SYSTEM'
) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');

  const propertyBusinessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());
  const failedAudit = await prisma.nightAudit.findFirst({
    where: { propertyId, status: 'FAILED', businessDate: { lt: propertyBusinessDate } },
    orderBy: { businessDate: 'desc' }
  });
  const isRecovery = Boolean(failedAudit);
  const businessDate = failedAudit?.businessDate || propertyBusinessDate;
  const nextBusinessDate = getNextBusinessDate(businessDate);
  const cutoffAt = new Date();
  const runReference = `NA-${propertyId}-${businessDate.toISOString().split('T')[0]}`;

  // Preparation checks happen before the short cutover lock. Existing shifts
  // must be reconciled before the old business date can be closed.
  if (!isRecovery) {
    const { openPosSessions, openFrontdeskSessions, financialSyncConflicts } = await getSystemIntegrity(ctx, propertyId);
    if (openPosSessions.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are open POS sessions.');
    if (openFrontdeskSessions.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are open front-desk cashier shifts.');
    if (financialSyncConflicts.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are unresolved financial sync conflicts.');
  }

  // Serialize audit starts on the property row. The old date is locked only
  // for this transaction; after it commits, the property is on the new date
  // and normal front-desk/POS activity can resume.
  const auditRun = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
    const current = await tx.property.findUnique({ where: { id: propertyId } });
    if (!current) throw new Error('NOT_FOUND:Property not found');
    if ((!isRecovery && current.businessDate?.getTime() !== businessDate.getTime()) ||
        (isRecovery && current.businessDate?.getTime() !== nextBusinessDate.getTime())) {
      throw new Error('CONFLICT:Business date changed before Night Audit started.');
    }

    const existing = await tx.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });
    if (existing?.status === 'COMPLETED') {
      throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`);
    }
    if (existing?.status === 'IN_PROGRESS' || existing?.status === 'POSTING') {
      throw new Error('CONFLICT:Night Audit is already in progress for this business date.');
    }
    if (isRecovery && existing?.status !== 'FAILED') {
      throw new Error('CONFLICT:Failed Night Audit recovery record is no longer available.');
    }

    const run = existing
      ? await tx.nightAudit.update({
          where: { id: existing.id },
          data: { status: 'IN_PROGRESS', runBy: userId, startedAt: cutoffAt, cutoffAt, runReference }
        })
      : await tx.nightAudit.create({
          data: { propertyId, businessDate, status: 'IN_PROGRESS', startedAt: cutoffAt, cutoffAt, runBy: userId, runReference }
        });

    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        propertyId,
        userId,
        userEmail: userEmail || 'unknown@system.local',
        userRole,
        action: 'NIGHT_AUDIT_STARTED',
        resource: 'NightAudit',
        resourceId: run.id,
        newValue: { businessDate, nextBusinessDate, runReference, phase: isRecovery ? 'RECOVERY' : 'CUTOVER' },
        ipAddress: reqIp,
        userAgent: reqUserAgent,
        requestId: crypto.randomUUID(),
      }
    });

    await tx.nightAudit.update({ where: { id: run.id }, data: { status: 'POSTING' } });
    if (!isRecovery) {
      const rollover = await tx.property.updateMany({
        where: { id: propertyId, businessDate },
        data: { businessDate: nextBusinessDate, auditStatus: 'POSTING' }
      });
      if (rollover.count !== 1) throw new Error('CONFLICT:Business date changed while Night Audit was starting.');
    } else {
      await tx.property.update({ where: { id: propertyId }, data: { auditStatus: 'POSTING' } });
    }

    // Activate rooms for reservations starting on the new business date
    const nextBusinessDateStr = nextBusinessDate.toISOString().split('T')[0];
    const newArrivals = await tx.reservationRoom.findMany({
      where: {
        reservation: { propertyId, status: 'CONFIRMED' },
        status: 'ACTIVE',
        roomId: { not: null },
      },
      include: { room: true }
    });

    for (const arrival of newArrivals) {
      if (arrival.checkIn.toISOString().split('T')[0] === nextBusinessDateStr) {
        if (arrival.room && (arrival.room.status === 'AVAILABLE' || arrival.room.status === 'CLEAN' || arrival.room.status === 'INSPECTED')) {
          await tx.room.update({
            where: { id: arrival.room.id },
            data: { status: 'RESERVED' }
          });
        }
      }
    }

    return run;
  });

  try {
    // 3. Post Room Charges
    const eligibleReservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      checkOut: { gt: businessDate }
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
            const roomChargeKey = `ROOM_CHARGE_${reservation.id}_${businessDate.toISOString().split('T')[0]}`;
            
            // Check if we already posted it in this run
            const existingCharge = await tx.folioItem.findFirst({
              where: {
                folioId: mainFolio.id,
                source: 'ROOM_CHARGE',
                businessDate,
                nightAuditRunId: auditRun.id
              }
            });

            if (!existingCharge) {
              const activeRoom = reservation.reservationRooms[0];
              const originalRate = activeRoom ? Number(activeRoom.rateAmount || 0) : Number(reservation.ratePlan?.baseRate || 0);
              
              // Calculate discount if applicable
              let discountDeduction = 0;
              if (activeRoom && activeRoom.discountType) {
                if (activeRoom.discountType === 'FIXED_AMOUNT') {
                  discountDeduction = Number(activeRoom.discountAmount || 0);
                } else if (activeRoom.discountType === 'PERCENTAGE') {
                  discountDeduction = originalRate * (Number(activeRoom.discountPercent || 0) / 100);
                }
              }
              
              const effectiveRate = Math.max(0, originalRate - discountDeduction);
              const discountApprovalId = activeRoom?.discountApprovalId || null;

              await tx.folioItem.create({
                data: {
                  folioId: mainFolio.id,
                  businessDate,
                  type: 'CHARGE',
                  source: 'ROOM_CHARGE',
                  description: discountDeduction > 0 
                    ? `Room Charge for ${businessDate.toISOString().split('T')[0]} (incl. discount)` 
                    : `Room Charge for ${businessDate.toISOString().split('T')[0]}`,
                  quantity: 1,
                  unitAmount: effectiveRate,
                  amount: effectiveRate,
                  baseAmount: effectiveRate, // Base amount tracks the effective amount actually posted
                  currency: property.supportedCurrencies[0] || 'NGN',
                  postedBy: userId || 'SYSTEM',
                  nightAuditRunId: auditRun.id,
                  discountApprovalId: discountApprovalId
                }
              });

                // Update folio balance and totalCharges
                await tx.folio.update({
                  where: { id: mainFolio.id },
                  data: { 
                    balance: { increment: effectiveRate },
                    totalCharges: { increment: effectiveRate }
                  }
                });

                // Automatically apply any available guest credit to this room charge
                await applyAvailableFolioCredit(tx, {
                  folioId: mainFolio.id,
                  propertyId,
                  guestId: reservation.primaryGuestId,
                  reservationId: reservation.id,
                  amount: effectiveRate,
                  currency: property.supportedCurrencies[0] || 'NGN',
                  source: 'NIGHT_AUDIT_ROOM_CHARGE',
                  description: `Applied guest credit to room charge - ${businessDate.toISOString().split('T')[0]}`,
                  appliedBy: userId || 'SYSTEM',
                  operationKey: roomChargeKey,
                  businessDate: businessDate
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

  // The date was already rolled during cutover. Finish the previous date's
  // posting work and publish a final, immutable audit result.
    const [roomRevenue, totalRevenue, roomCount, occupiedCount] = await Promise.all([
    prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: 'CHARGE', source: 'ROOM_CHARGE', voidedAt: null }, _sum: { amount: true } }),
    prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: 'CHARGE', voidedAt: null }, _sum: { amount: true } }),
    prisma.room.count({ where: { propertyId, isActive: true } }),
    prisma.room.count({ where: { propertyId, isActive: true, status: 'OCCUPIED' } })
    ]);
    const totalRoomRevenue = Number(roomRevenue._sum?.amount || 0);
    const totalRevenueValue = Number(totalRevenue._sum?.amount || 0);
    const occupancy = roomCount ? (occupiedCount / roomCount) * 100 : 0;
    const adr = occupiedCount ? totalRoomRevenue / occupiedCount : 0;
    const revpar = roomCount ? totalRoomRevenue / roomCount : 0;

  // Final atomic commit — NightAudit completion, property status, occupancy snapshot,
  // and audit log all succeed together or all roll back.
  
  const roomStatusCounts = await prisma.room.groupBy({
    by: ['status'],
    where: { propertyId },
    _count: { status: true }
  });
  const outOfOrderRooms = roomStatusCounts.find((r: any) => r.status === 'OUT_OF_ORDER')?._count?.status ?? 0;
  const blockedRooms = roomStatusCounts.find((r: any) => r.status === 'BLOCKED')?._count?.status ?? 0;

  const [completedAudit] = await prisma.$transaction([
    // 1. Mark NightAudit COMPLETED
    prisma.nightAudit.update({
      where: { id: auditRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tasksCreated: { increment: totalTasksCreated },
        tasksSkipped: { increment: totalTasksSkipped },
        roomChargesPosted: { increment: totalRoomChargesPosted },
        errors: { increment: errors },
        totalRoomRevenue,
        totalRevenue: totalRevenueValue,
        occupancy,
        adr,
        revpar,
      }
    }),
    // 2. Update property audit status
    prisma.property.update({
      where: { id: propertyId },
      data: {
        lastAuditAt: new Date(),
        auditStatus: errors > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED'
      }
    }),
    // 3. Snapshot occupancy — atomic with audit completion for KPI reporting consistency.
    //    If this fails, the audit is NOT marked COMPLETED, preventing a phantom 'done' state.
    prisma.occupancySnapshot.upsert({
      where: { propertyId_businessDate: { propertyId, businessDate } },
      create: {
        propertyId,
        businessDate,
        totalRooms: roomCount,
        occupiedRooms: occupiedCount,
        availableRooms: roomCount - occupiedCount,
        outOfOrderRooms,
        blockedRooms,
        occupancyPct: occupancy,
        adr,
        revpar,
        currency: property.supportedCurrencies?.[0] || 'NGN',
      },
      update: { occupancyPct: occupancy, adr, revpar, totalRooms: roomCount, occupiedRooms: occupiedCount, outOfOrderRooms, blockedRooms }
    }),
    // 4. Audit log — atomic so it cannot say 'COMPLETED' if the update rolled back
    prisma.auditLog.create({
      data: {
        organizationId: property.organizationId,
        propertyId,
        userId,
        userEmail: userEmail || 'unknown@system.local',
        userRole,
        action: 'NIGHT_AUDIT_COMPLETED',
        resource: 'NightAudit',
        resourceId: auditRun.id,
        newValue: {
          tasksCreated: totalTasksCreated,
          chargesPosted: totalRoomChargesPosted,
          phase: 'COMPLETED',
          businessDate,
          nextBusinessDate,
          occupancy,
          totalRoomRevenue,
        },
        ipAddress: reqIp,
        userAgent: reqUserAgent,
        requestId: crypto.randomUUID(),
      }
    })
  ]);

  return {
    auditId: completedAudit.id,
    tasksCreated: totalTasksCreated,
    tasksSkipped: totalTasksSkipped,
    roomChargesPosted: totalRoomChargesPosted,
    errors
  };
  } catch (error) {
    await prisma.nightAudit.update({
      where: { id: auditRun.id },
      data: { status: 'FAILED', completedAt: null, notes: error instanceof Error ? error.message : String(error) }
    }).catch((updateError) => console.error('[Night Audit] Failed to mark run FAILED:', updateError));
    await prisma.property.update({
      where: { id: propertyId },
      data: { auditStatus: 'FAILED' }
    }).catch((updateError) => console.error('[Night Audit] Failed to mark property audit FAILED:', updateError));
    throw error;
  }
}

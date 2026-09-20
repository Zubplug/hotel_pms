import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';
import { applyAvailableFolioCredit } from '@/lib/finance/apply-folio-credit';
import { postNightAuditJournal, buildNightAuditBalanceProof } from './night-audit-accounting';

const BATCH_SIZE = 50;

import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation, getFnbControl } from './night-audit-service';

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
  if (financial.unverifiedComplimentary?.length > 0) blockers++;

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
    // A failed run normally remains on the current business date. The
    // `lt` case is retained for properties that were already rolled forward
    // by the pre-fix cutover flow and need to be recovered safely.
    where: { propertyId, status: 'FAILED', businessDate: { lte: propertyBusinessDate } },
    orderBy: { businessDate: 'desc' }
  });
  const isRecovery = Boolean(failedAudit);
  const businessDate = failedAudit?.businessDate || propertyBusinessDate;
  const nextBusinessDate = getNextBusinessDate(businessDate);
  const legacyRolloverDetected = Boolean(
    failedAudit &&
    businessDate.getTime() < propertyBusinessDate.getTime() &&
    nextBusinessDate.getTime() === propertyBusinessDate.getTime()
  );
  const cutoffAt = new Date();
  const runReference = `NA-${propertyId}-${businessDate.toISOString().split('T')[0]}`;

  // Preparation checks happen before the short cutover lock. Existing shifts
  // must be reconciled before the old business date can be closed.
  if (!isRecovery) {
    const { openPosSessions, openFrontdeskSessions, financialSyncConflicts, openPosOrders } = await getSystemIntegrity(ctx, propertyId);
    const { unverifiedComplimentary, pendingCheckInBypasses } = await getFinancialAudit(ctx, propertyId);
    const { unverifiedTransactions } = await getCashReconciliation(ctx, propertyId);
    const { exceptions: { openOrders: additionalFnbOpenOrders, openSessions: additionalFnbOpenSessions } } = await getFnbControl(ctx, propertyId);
    
    if (unverifiedComplimentary.length > 0) throw new Error('BLOCKER:Cannot execute audit. Unverified complimentary transactions must be resolved.');
    if (pendingCheckInBypasses.length > 0) throw new Error('BLOCKER:Cannot execute audit. Pending check-in bypasses must be resolved.');
    if (unverifiedTransactions.length > 0) throw new Error('BLOCKER:Cannot execute audit. Unverified cash/bank transactions exist.');
    
    if (openPosSessions.length > 0 || additionalFnbOpenSessions.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are open POS sessions.');
    if (openFrontdeskSessions.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are open front-desk cashier shifts.');
    if (openPosOrders.length > 0 || additionalFnbOpenOrders.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are open POS orders.');
    
    if (financialSyncConflicts.length > 0) throw new Error('BLOCKER:Cannot execute audit. There are unresolved financial sync conflicts.');

    // Auto-close RECONCILIATION_REQUIRED POS sessions with zero expected cash.
    // These are SERVER-banking waiter sessions already submitted; no physical
    // cash handover is needed so the Night Audit closes them automatically.
    const zeroVarianceSessions = await prisma.posSession.findMany({
      where: {
        propertyId,
        businessDate: property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date()),
        status: 'RECONCILIATION_REQUIRED',
        expectedCash: 0,
      },
      select: { id: true }
    });
    if (zeroVarianceSessions.length > 0) {
      await prisma.posSession.updateMany({
        where: { id: { in: zeroVarianceSessions.map(s => s.id) } },
        data: { status: 'CLOSED', closedAt: new Date() }
      });
      console.log(`[Night Audit] Auto-closed ${zeroVarianceSessions.length} zero-variance RECONCILIATION_REQUIRED POS session(s).`);
    }
  }

  // Serialize audit starts on the property row. The old date is locked only
  // for this transaction; after it commits, the property is on the new date
  // and normal front-desk/POS activity can resume.
  const auditRun = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
    const current = await tx.property.findUnique({ where: { id: propertyId } });
    if (!current) throw new Error('NOT_FOUND:Property not found');
    // Older versions advanced the property date before posting. Restore that
    // state before recovery so the failed date is again the active business
    // date. New runs never advance the date in this opening transaction.
    if (legacyRolloverDetected) {
      await tx.property.update({
        where: { id: propertyId },
        data: { businessDate, auditStatus: 'FAILED' },
      });
      current.businessDate = businessDate;
    }

    if (current.businessDate?.getTime() !== businessDate.getTime()) {
      throw new Error('CONFLICT:Business date changed before Night Audit started.');
    }

    const existing = await tx.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });
    if (existing?.status === 'COMPLETED') {
      throw new Error(`CONFLICT:Night Audit for ${businessDate.toISOString().split('T')[0]} has already been completed.`);
    }
    if (existing?.status === 'IN_PROGRESS' || existing?.status === 'POSTING') {
      const isStale = existing.updatedAt && (existing.updatedAt.getTime() < Date.now() - 45 * 60 * 1000);
      if (isStale) {
        const recovered = await tx.nightAudit.updateMany({
          where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
          data: { status: 'FAILED', notes: 'Auto-recovered stale audit run', completedAt: new Date(), updatedAt: new Date() }
        });
        if (recovered.count === 0) {
           throw new Error('CONFLICT:Night Audit is currently being recovered by another process.');
        }
        await tx.auditLog.create({
          data: {
             organizationId: property.organizationId,
             propertyId,
             userId,
             userEmail: userEmail || 'unknown@system.local',
             userRole,
             action: 'NIGHT_AUDIT_STALE_RECOVERED',
             resource: 'NightAudit',
             resourceId: existing.id,
             newValue: { previousStatus: existing.status, lastUpdated: existing.updatedAt },
             ipAddress: reqIp,
             userAgent: reqUserAgent,
             requestId: crypto.randomUUID(),
          }
        });
        existing.status = 'FAILED';
      } else {
        throw new Error('CONFLICT:Night Audit is already in progress for this business date.');
      }
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
    // Keep the current business date unchanged while posting. It is advanced
    // only in the final atomic completion transaction below.
    await tx.property.update({ where: { id: propertyId }, data: { auditStatus: 'POSTING' } });

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
    // Resolve a valid UUID actor for DB fields that require one (postedBy, appliedBy).
    // When the audit is triggered by a logged-in user userId is already a UUID;
    // for scheduled / system runs we fall back to the first Night Auditor / Manager
    // on this property so the UUID constraint is never violated.
    let actorId = userId;
    if (!actorId) {
      const fallbackStaff = await prisma.staff.findFirst({
        where: { propertyAccess: { has: propertyId }, position: { in: ['NIGHT_AUDITOR', 'HOTEL_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true }
      });
      actorId = fallbackStaff?.id ?? null;
    }

    // 3. Post Room Charges
    const eligibleReservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'CHECKED_IN',
    },
    include: {
      priorities: true,
      reservationRooms: {
        where: { status: 'ACTIVE' },
        include: { room: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      },
      folios: { where: { type: { in: ['MAIN', 'ROOM', 'CITY_LEDGER'] }, status: 'OPEN' } },
      ratePlan: true,
      corporateAccount: { include: { ratePlan: true } },
    }
    });

    let totalTasksCreated = 0;
    let totalTasksSkipped = 0;
    let totalRoomChargesPosted = 0;
    let errors = 0;

    let lastHeartbeat = Date.now();
    for (let i = 0; i < eligibleReservations.length; i += BATCH_SIZE) {
      const batch = eligibleReservations.slice(i, i + BATCH_SIZE);

      if (Date.now() - lastHeartbeat > 15000) {
        await prisma.nightAudit.update({
          where: { id: auditRun.id },
          data: { updatedAt: new Date() }
        }).catch((e) => console.error('[Night Audit] Heartbeat failed:', e));
        lastHeartbeat = Date.now();
      }

      await Promise.all(batch.map(async (reservation: any) => {
      try {
        await prisma.$transaction(async (tx: any) => {
          // Re-read the assignment inside the posting transaction. The
          // candidate list is loaded before posting begins, so it can contain
          // a room that was replaced afterward. The newest active assignment
          // is the guest's authoritative room for this audit.
          const currentAssignments = await tx.reservationRoom.findMany({
            where: { reservationId: reservation.id, status: 'ACTIVE' },
            include: { room: true },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          });
          const activeRoom = currentAssignments[0] || null;

          if (currentAssignments.length > 1) {
            console.warn(
              `[Night Audit] Reservation ${reservation.id} has ${currentAssignments.length} active room assignments; using ${activeRoom?.room?.number || activeRoom?.roomId || 'latest assignment'}.`,
            );
          }
          
          // Post Room Charge Idempotently
          if (reservation.folios && reservation.folios.length > 0 || reservation.corporateAccountId) {
            const sharedCorporateFolio = reservation.corporateAccountId
              ? await tx.folio.findFirst({
                  where: {
                    propertyId,
                    corporateAccountId: reservation.corporateAccountId,
                    type: 'CITY_LEDGER',
                    status: 'OPEN',
                  },
                })
              : null;
            const mainFolio = reservation.corporateAccountId
              ? sharedCorporateFolio
              : reservation.folios[0];
            if (!mainFolio) {
              if (reservation.corporateAccountId) {
                throw new Error(`Shared corporate CITY_LEDGER folio missing for reservation ${reservation.id}`);
              }
              return;
            }
            const roomChargeKey = `ROOM_CHARGE_${reservation.id}_${businessDate.toISOString().split('T')[0]}`;
            
            const isCorporateCharge = Boolean(reservation.corporateAccountId);

            // Corporate rooms share one CITY_LEDGER folio. Their idempotency
            // must therefore be reservation-specific; checking only the folio
            // would make the first room suppress every later room.
            const existingCharge = await tx.folioItem.findFirst({
              where: isCorporateCharge
                ? { operationId: roomChargeKey }
                : {
                    folioId: mainFolio.id,
                    source: 'ROOM_CHARGE',
                    businessDate,
                    nightAuditRunId: auditRun.id,
                  },
            });

            if (!existingCharge) {
              let originalRate = activeRoom
                ? Number(activeRoom.rateAmount || 0)
                : Number(reservation.ratePlan?.baseRate || 0);
              let chargeCurrency = activeRoom?.currency || property.supportedCurrencies[0] || 'NGN';

              // Corporate reservations keep the originally selected rate on
              // ReservationRoom. Resolve the negotiated corporate rate for
              // the room type and audit date before posting the charge.
              if (isCorporateCharge && activeRoom && reservation.corporateAccount?.ratePlanId) {
                const corporateRate = await tx.rate.findFirst({
                  where: {
                    propertyId,
                    ratePlanId: reservation.corporateAccount.ratePlanId,
                    roomTypeId: activeRoom.roomTypeId,
                    effectiveFrom: { lte: businessDate },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gte: businessDate } }],
                    dayOfWeek: { has: businessDate.getUTCDay() },
                  },
                  orderBy: { effectiveFrom: 'desc' },
                });
                if (corporateRate) {
                  originalRate = Number(corporateRate.amount);
                  chargeCurrency = corporateRate.currency || chargeCurrency;
                }
              }
              
              // Calculate discount only if Night Auditor has APPROVED it
              let discountDeduction = 0;
              let discountApprovalId = activeRoom?.discountApprovalId || null;
              let discountNote = '';

              // Complimentary room requests are verified by the Night Auditor
              // through ComplimentaryRecord rather than ApprovalRequest.
              const verifiedComplimentary = activeRoom?.roomId
                ? await tx.complimentaryRecord.findFirst({
                    where: {
                      propertyId,
                      businessDate,
                      roomId: activeRoom.roomId,
                      guestId: reservation.primaryGuestId,
                      sourceModule: 'FRONT_DESK',
                      status: 'VERIFIED',
                    },
                    select: { id: true, complAmount: true, complType: true },
                  })
                : null;

              const unresolvedComplimentary = activeRoom?.roomId
                ? await tx.complimentaryRecord.findFirst({
                    where: {
                      propertyId,
                      businessDate,
                      roomId: activeRoom.roomId,
                      guestId: reservation.primaryGuestId,
                      sourceModule: 'FRONT_DESK',
                      status: { in: ['PENDING_NIGHT_AUDIT', 'UNRESOLVED'] },
                    },
                    select: { id: true },
                  })
                : null;

              if (unresolvedComplimentary || (activeRoom?.discountType === 'COMPLIMENTARY' && !verifiedComplimentary)) {
                throw new Error(
                  `BLOCKER:Complimentary room for reservation ${reservation.id} must be verified before room charges are posted.`,
                );
              }

              if (verifiedComplimentary) {
                discountDeduction = verifiedComplimentary.complType === 'FULL'
                  ? originalRate
                  : Math.min(originalRate, Number(verifiedComplimentary.complAmount || 0));
                discountNote = ' (complimentary approved by Night Auditor)';
              }

              if (!verifiedComplimentary && activeRoom?.discountType && discountApprovalId) {
                // Check approval status
                // Reservation creation stores a pending marker until the approval
                // endpoint replaces it with the canonical approval ID.
                const approvalId = discountApprovalId.startsWith('PENDING:')
                  ? discountApprovalId.slice('PENDING:'.length)
                  : discountApprovalId;
                const approval = await tx.approvalRequest.findUnique({
                  where: { id: approvalId },
                  select: { status: true },
                });

                if (approval?.status === 'APPROVED') {
                  if (activeRoom.discountType === 'FIXED_AMOUNT') {
                    discountDeduction = Number(activeRoom.discountAmount || 0);
                  } else if (activeRoom.discountType === 'PERCENTAGE') {
                    discountDeduction = originalRate * (Number(activeRoom.discountPercent || 0) / 100);
                  } else if (activeRoom.discountType === 'COMPLIMENTARY') {
                    const compAmt = Number(activeRoom.discountAmount || 0);
                    if (compAmt > 0) {
                      discountDeduction = compAmt;
                    } else {
                      discountDeduction = originalRate;
                    }
                  }
                } else {
                  // Discount not approved — charge full rate and note it
                  const statusLabel = approval?.status === 'PENDING' ? 'pending auditor approval' : 'rejected';
                  discountNote = ` (discount ${statusLabel} — full rate applied)`;
                  discountApprovalId = null; // don't link unapproved discount to folio
                }
              }
              
              const effectiveRate = Math.max(0, originalRate - discountDeduction);
              const auditDateLabel = businessDate.toISOString().split('T')[0];

              // Keep gross room revenue and the guest concession as separate
              // folio lines. This is the hotel-accounting treatment for a
              // complimentary night: Room Revenue is credited at gross, then
              // Guest Complimentary (contra-revenue) is debited for the
              // approved concession. The folio balance remains net.
              const grossRoomCharge = discountDeduction > 0 ? originalRate : effectiveRate;
              await tx.folioItem.create({
                data: {
                  folioId: mainFolio.id,
                  businessDate,
                  type: 'CHARGE',
                  source: 'ROOM_CHARGE',
                  revenueCategory: 'ROOM',
                  description: `Room Charge for ${auditDateLabel}${discountDeduction > 0 ? ' (gross)' : discountNote}`,
                  quantity: 1,
                  unitAmount: grossRoomCharge,
                  amount: grossRoomCharge,
                  baseAmount: grossRoomCharge,
                  currency: chargeCurrency,
                  postedBy: actorId!,
                  nightAuditRunId: auditRun.id,
                  operationId: roomChargeKey,
                  discountApprovalId: null,
                  reservationId: reservation.id,
                  guestId: reservation.primaryGuestId,
                }
              });

              if (discountDeduction > 0) {
                const concessionItem = await tx.folioItem.create({
                  data: {
                    folioId: mainFolio.id,
                    businessDate,
                    type: verifiedComplimentary ? 'COMPLIMENTARY' : 'DISCOUNT',
                    source: 'ROOM_CHARGE',
                    revenueCategory: 'ROOM',
                    description: verifiedComplimentary
                      ? `Guest Complimentary for ${auditDateLabel}`
                      : `Approved room discount for ${auditDateLabel}`,
                    quantity: 1,
                    unitAmount: -discountDeduction,
                    amount: -discountDeduction,
                    baseAmount: -discountDeduction,
                    currency: chargeCurrency,
                    postedBy: actorId!,
                    nightAuditRunId: auditRun.id,
                    operationId: `${roomChargeKey}:CONCESSION`,
                    discountApprovalId: discountApprovalId,
                    reservationId: reservation.id,
                    guestId: reservation.primaryGuestId,
                  }
                });

                if (verifiedComplimentary) {
                  await tx.complimentaryRecord.updateMany({
                    where: { id: verifiedComplimentary.id },
                    data: { folioItemId: concessionItem.id },
                  });
                }
              }

              // Update the folio with the net amount after the concession.
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
                  currency: chargeCurrency,
                  source: 'NIGHT_AUDIT_ROOM_CHARGE',
                  description: `Applied guest credit to room charge - ${businessDate.toISOString().split('T')[0]}`,
                  appliedBy: actorId!,
                  operationKey: roomChargeKey,
                  businessDate: businessDate
                });
              
              totalRoomChargesPosted++;
            } else {
              // Recovery runs are idempotent: the failed attempt may already
              // have created this charge. Count it as processed without
              // creating a duplicate folio line.
              totalRoomChargesPosted++;
            }
          }

          // Generate Housekeeping Tasks Idempotently. Housekeeping is best
          // effort: a task conflict or room update failure must not roll back
          // the room charge that was already posted in this transaction.
          try {
            for (const rr of currentAssignments) {
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
              data: {
                housekeepingStatus: 'CLEANING',
                ...(!['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(room.status)
                  ? { status: 'OCCUPIED' }
                  : {})
              }
            });
            
              totalTasksCreated++;
            }
          } catch (e) {
            console.error(`[Night Audit] Housekeeping task failed for reservation ${reservation.id}; room charge retained:`, e);
            errors++;
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
    const [revenueByCategory, otherItemsByType, roomCount, occupiedCount, posOrders, posFolioItems] = await Promise.all([
      prisma.folioItem.groupBy({
        by: ['source', 'revenueCategory'],
        where: { folio: { propertyId }, businessDate, type: 'CHARGE', voidedAt: null },
        _sum: { amount: true }
      }),
      prisma.folioItem.groupBy({
        by: ['type'],
        where: { folio: { propertyId }, businessDate, type: { in: ['TAX', 'DISCOUNT', 'REFUND', 'COMPLIMENTARY'] }, voidedAt: null },
        _sum: { amount: true }
      }),
      prisma.room.count({ where: { propertyId, isActive: true } }),
      prisma.room.count({ where: { propertyId, isActive: true, status: 'OCCUPIED' } }),
      prisma.posOrder.findMany({
        // Offline POS orders can have confirmed payments while their header
        // paymentStatus remains UNPAID. Count closed orders with confirmed
        // payments so F&B revenue is not omitted from the audit snapshot.
        where: { propertyId, businessDate, status: 'CLOSED', payments: { some: { status: 'CONFIRMED' } } },
        select: {
          id: true,
          total: true,
          subtotal: true,
          taxAmount: true,
          serviceCharge: true,
          outletId: true,
          items: { select: { quantity: true, unitPrice: true, subtotal: true, product: { select: { itemCode: true } } } },
          payments: { where: { status: 'CONFIRMED' }, select: { amount: true, method: true } },
        },
      }),
      prisma.folioItem.findMany({
        // POS folio items are identified by their POS transaction link. Avoid
        // filtering on the source enum here because older generated Prisma
        // clients may not contain the current POS enum value.
        where: { folio: { propertyId }, businessDate, type: 'CHARGE', posTransactionId: { not: null }, voidedAt: null },
        select: { posTransactionId: true },
      })
    ]);

    let roomRevenueVal = 0, fnbRevenueVal = 0, poolRevenueVal = 0, otherRevenueVal = 0, taxesVal = 0, serviceChargeVal = 0, discountsVal = 0, refundsVal = 0;

    for (const group of revenueByCategory) {
      const amt = Number(group._sum?.amount || 0);
      // ROOM_CHARGE is the source of truth for accommodation revenue. This
      // protects older/imported room charges whose revenueCategory was left at
      // the schema default of OTHER.
      if (group.source === 'ROOM_CHARGE' || group.revenueCategory === 'ROOM') roomRevenueVal += amt;
      else if (group.source === 'POS' || group.revenueCategory === 'FNB') fnbRevenueVal += amt;
      else if (group.revenueCategory === 'OTHER') otherRevenueVal += amt;
      else if (group.revenueCategory === 'TAX') taxesVal += amt;
    }

    // POS orders paid directly by cash/card are not represented by folio
    // items. Add them to F&B revenue, while excluding room-charge orders that
    // already have a POS folio item so the same sale is never counted twice.
    const posOutlets = await prisma.posOutlet.findMany({ where: { propertyId }, select: { id: true, type: true } });
    const outletTypes = new Map(posOutlets.map((o: any) => [o.id, o.type]));

    const posFolioOrderIds = new Set(posFolioItems.map((item) => item.posTransactionId).filter(Boolean));
    for (const order of posOrders) {
      if (posFolioOrderIds.has(order.id)) continue;
      const complimentary = order.payments
        .filter((payment) => String(payment.method).toUpperCase() === 'COMPLIMENTARY')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      
      const netPaid = Math.max(0, Number(order.total) - complimentary);
      const outletType = order.outletId ? outletTypes.get(order.outletId) : null;
      
      let allocatedRevenue = 0;
      let orderPool = 0;
      let orderFnb = 0;
      
      for (const item of (order.items || [])) {
        // Some legacy/offline POS payloads persisted subtotal as zero while
        // retaining the authoritative quantity and unit price. A zero here
        // makes the whole paid order look like residual/Other revenue.
        const persistedSubtotal = Number(item.subtotal);
        const itemSubtotal = persistedSubtotal > 0
          ? persistedSubtotal
          : Number(item.quantity) * Number(item.unitPrice);
        if (itemSubtotal <= 0) continue;
        allocatedRevenue += itemSubtotal;
        
        const isPoolPass = item.product?.itemCode?.startsWith('REC-POOL');
        if (isPoolPass || outletType === 'RECREATION') {
          orderPool += itemSubtotal;
        } else {
          orderFnb += itemSubtotal;
        }
      }
      
      const tax = Number(order.taxAmount || 0);
      const serviceCharge = Number(order.serviceCharge || 0);
      
      // Allocate partial payments in the same order as the bill: revenue,
      // then tax, then service charge. Never classify a payment shortfall as
      // Other Revenue merely because the order was only partly settled.
      const revenuePaid = Math.min(netPaid, allocatedRevenue);
      const revenueRatio = allocatedRevenue > 0 ? revenuePaid / allocatedRevenue : 0;
      fnbRevenueVal += orderFnb * revenueRatio;
      poolRevenueVal += orderPool * revenueRatio;

      let unapplied = Math.max(0, netPaid - revenuePaid);
      const taxPaid = Math.min(tax, unapplied);
      taxesVal += taxPaid;
      unapplied -= taxPaid;
      const serviceChargePaid = Math.min(serviceCharge, unapplied);
      serviceChargeVal += serviceChargePaid;
      unapplied -= serviceChargePaid;

      // A legacy order can have no item allocation. Its paid net amount is
      // still POS/F&B production, not Other Revenue; only a true overage is
      // left in Other Revenue for accountant review.
      if (allocatedRevenue === 0) {
        fnbRevenueVal += Math.max(0, netPaid - tax - serviceCharge);
        unapplied = 0;
      }
      if (unapplied > 0.01) otherRevenueVal += unapplied;
    }

    for (const group of otherItemsByType) {
      const amt = Number(group._sum?.amount || 0);
      if (group.type === 'TAX') taxesVal += amt;
      else if (group.type === 'DISCOUNT' || group.type === 'COMPLIMENTARY') discountsVal += Math.abs(amt);
      else if (group.type === 'REFUND') refundsVal += amt;
    }

    // Since NightAuditFinancialSnapshot schema does not have a pool or service charge bucket,
    // we logically fold them into otherRevenueVal and taxes for the gross calculations.
    // The departmentReconciliation accurately reflects their GL split.
    const schemaOtherRevenue = otherRevenueVal + poolRevenueVal + serviceChargeVal;

    const grossRevenueVal = roomRevenueVal + fnbRevenueVal + schemaOtherRevenue;
    const netRevenueVal = grossRevenueVal - discountsVal - refundsVal;

    const totalRoomRevenue = roomRevenueVal;
    const totalRevenueValue = grossRevenueVal;
    const occupancy = roomCount ? (occupiedCount / roomCount) * 100 : 0;
    const adr = occupiedCount ? totalRoomRevenue / occupiedCount : 0;
  const revpar = roomCount ? totalRoomRevenue / roomCount : 0;
  const journalBusinessDate = new Date(businessDate.getTime());

  const [completedAudit, finalErrors] = await prisma.$transaction(async (tx) => {
    let txErrors = errors;
    const journalPosting = await postNightAuditJournal(tx, {
      propertyId,
      businessDate: journalBusinessDate,
      auditId: auditRun.id,
      createdBy: userId,
    });
    if (journalPosting.status !== 'POSTED') {
      txErrors++;
      console.error('[Night Audit] Accounting journal was not posted:', journalPosting);
      throw new Error(`BLOCKER:Night Audit cannot close without a posted accounting journal (${journalPosting.status}).`);
    }

    const postedJournals = await tx.journalEntry.findMany({
      where: { propertyId, entryDate: journalBusinessDate, status: 'POSTED' },
      select: { id: true },
    });
    const journalLines = postedJournals.length ? await tx.journalEntryLine.findMany({
      where: { entryId: { in: postedJournals.map((entry) => entry.id) } },
      select: { debit: true, credit: true, account: { select: { code: true } } },
    }) : [];
    
    const glCredit = (code: string) => journalLines.filter((line) => line.account.code === code).reduce((sum, line) => sum + Number(line.credit), 0);
    const departmentReconciliation = [
      { department: 'Rooms', source: roomRevenueVal, gl: glCredit('4050') },
      { department: 'F&B/POS', source: fnbRevenueVal, gl: glCredit('4250') },
      { department: 'Recreation/Pool', source: poolRevenueVal, gl: glCredit('4100') },
      { department: 'Other', source: otherRevenueVal, gl: glCredit('4400') },
      { department: 'Taxes', source: taxesVal, gl: glCredit('2200') },
      { department: 'Service Charge', source: serviceChargeVal, gl: glCredit('2210') },
    ].map((row) => ({ ...row, difference: row.source - row.gl, status: Math.abs(row.source - row.gl) < 0.01 ? 'MATCHED' : 'VARIANCE' }));
    
    const hasDepartmentVariance = departmentReconciliation.some((row) => row.status === 'VARIANCE');
    
    const balanceRows = (await buildNightAuditBalanceProof(tx, { propertyId, businessDate })).map((row) => ({
      ...row,
      propertyId,
      businessDate,
    }));
    const balanceProofRows = balanceRows.map(({ propertyId: _propertyId, businessDate: _businessDate, ...row }) => row);
    const balanceProofStatus = balanceProofRows.every((row) => row.status === 'PROVEN') ? 'PROVEN' : balanceProofRows.some((row) => row.status === 'HAS_VARIANCE') ? 'HAS_VARIANCE' : 'INCOMPLETE';
    
    const [paymentMethodTotals, unresolvedExceptionCount, latePostingCount, voidCount, adjustmentCount, cashTotals] = await Promise.all([
      tx.payment.groupBy({ by: ['method'], where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: { id: true } }),
      tx.transactionException.count({ where: { propertyId, businessDate, status: { in: ['OPEN', 'PENDING_APPROVAL'] } } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, voidedAt: { not: null } } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, type: 'ADJUSTMENT', voidedAt: null } }),
      tx.posSession.aggregate({ where: { propertyId, businessDate }, _sum: { expectedCash: true, actualCash: true, variance: true } }),
    ]);
    const paymentTotals = paymentMethodTotals.map((row) => ({ method: row.method, amount: Number(row._sum.amount || 0), count: row._count.id }));
    const snapshotReconciliationStatus = balanceProofStatus === 'PROVEN' && journalPosting.status === 'POSTED' && unresolvedExceptionCount === 0 && !hasDepartmentVariance ? 'RECONCILED' : 'HAS_EXCEPTIONS';
    if (hasDepartmentVariance || balanceProofStatus !== 'PROVEN') txErrors++;
    
    const closeSourceTotals = {
      roomRevenue: roomRevenueVal,
      fnbRevenue: fnbRevenueVal,
      otherRevenue: schemaOtherRevenue,
      taxes: taxesVal,
      discounts: discountsVal,
      refunds: refundsVal,
      grossRevenue: grossRevenueVal,
      netRevenue: netRevenueVal,
      paymentTotals,
      cashExpected: Number(cashTotals._sum.expectedCash || 0),
      cashDeclared: Number(cashTotals._sum.actualCash || 0),
      cashVariance: Number(cashTotals._sum.variance || 0),
      unresolvedExceptionCount,
      latePostingCount,
      voidCount,
      adjustmentCount,
    };
    const closeBalanceProof = {
      status: balanceProofStatus,
      reason: 'Account-level balance rows are preserved with the close package; unavailable ledgers remain explicitly marked.',
      ledgers: balanceProofRows,
      journal: { postedEntryCount: postedJournals.length, status: journalPosting.status, missingAccounts: journalPosting.missingAccounts },
    };
    const closeControlSummary = {
      errors: txErrors,
      roomChargesPosted: totalRoomChargesPosted,
      tasksCreated: totalTasksCreated,
      tasksSkipped: totalTasksSkipped,
      occupancy,
      adr,
      revpar,
      journalPosting,
      balanceProofStatus,
      departmentReconciliation,
    };
    const closeReportManifest = [
      'managers-flash', 'detailed-revenue', 'trial-balance', 'cashier-summary',
      'payment-method-reconciliation', 'tax-summary', 'guest-ledger', 'city-ledger',
      'no-show', 'room-status', 'voids-and-adjustments', 'discounts-and-complimentary',
      'refunds', 'late-postings', 'pos-settlement', 'exception-register',
      'audit-acknowledgements', 'final-gl-journal',
    ].map((key) => ({ key, auditId: auditRun.id, businessDate: businessDate.toISOString() }));
    
    const closePackageHash = crypto.createHash('sha256').update(JSON.stringify({
      runReference,
      businessDate: businessDate.toISOString(),
      closeSourceTotals,
      closeBalanceProof,
      closeControlSummary,
      closeReportManifest,
      journalEntryIds: postedJournals.map((entry) => entry.id),
      journalPosting,
      departmentReconciliation,
    })).digest('hex');

    const runUpdate = await tx.nightAudit.update({
      where: { id: auditRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tasksCreated: { increment: totalTasksCreated },
        tasksSkipped: { increment: totalTasksSkipped },
        roomChargesPosted: { increment: totalRoomChargesPosted },
        errors: { increment: txErrors },
        totalRoomRevenue,
        totalRevenue: totalRevenueValue,
        occupancy,
        adr,
        revpar,
      }
    });

    await tx.nightAuditFinancialSnapshot.create({
      data: {
        nightAuditId: auditRun.id,
        roomRevenue: roomRevenueVal,
        fnbRevenue: fnbRevenueVal,
        otherRevenue: schemaOtherRevenue,
        taxes: taxesVal,
        discounts: discountsVal,
        refunds: refundsVal,
        grossRevenue: grossRevenueVal,
        netRevenue: netRevenueVal,
        paymentTotals,
        cashExpected: Number(cashTotals._sum.expectedCash || 0),
        cashDeclared: Number(cashTotals._sum.actualCash || 0),
        cashVariance: Number(cashTotals._sum.variance || 0),
        unresolvedExceptionCount,
        latePostingCount,
        voidCount,
        adjustmentCount,
        journalEntryIds: postedJournals.map((entry) => entry.id),
        reconciliationStatus: snapshotReconciliationStatus,
        snapshotHash: closePackageHash,
        finalizedAt: new Date(),
      }
    });

    await tx.nightAuditClosePackage.create({
      data: {
        nightAuditId: auditRun.id,
        propertyId,
        businessDate,
        status: txErrors > 0 || (grossRevenueVal > 0 && postedJournals.length === 0)
          ? 'COMPLETED_WITH_EXCEPTIONS'
          : 'COMPLETED',
        sourceTotals: closeSourceTotals,
        balanceProof: closeBalanceProof,
        controlSummary: closeControlSummary,
        reportManifest: closeReportManifest,
        journalEntryIds: postedJournals.map((entry) => entry.id),
        packageHash: closePackageHash,
        createdBy: userId,
        finalizedAt: new Date(),
        accountBalances: { create: balanceRows },
      },
    });

    await tx.property.update({
      where: { id: propertyId },
      data: {
        businessDate: nextBusinessDate,
        lastAuditAt: new Date(),
        auditStatus: txErrors > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED'
      }
    });

    const roomStatusCounts = await tx.room.groupBy({
      by: ['status'],
      where: { propertyId },
      _count: { status: true }
    });
    const outOfOrderRooms = roomStatusCounts.find((r: any) => r.status === 'OUT_OF_ORDER')?._count?.status ?? 0;
    const blockedRooms = roomStatusCounts.find((r: any) => r.status === 'BLOCKED')?._count?.status ?? 0;

    await tx.occupancySnapshot.upsert({
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
    });

    await tx.auditLog.create({
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
    });

    await tx.hotelActivityEvent.create({
      data: {
        propertyId,
        businessDate,
        occurredAt: new Date(),
        category: 'NIGHT_AUDIT',
        eventType: 'NIGHT_AUDIT_COMPLETED',
        actorId: userId,
        actorName: 'SYSTEM',
        title: `Night Audit Completed for ${businessDate.toISOString().split('T')[0]}`,
        description: `Successfully closed business date. Gross Revenue: ${grossRevenueVal.toLocaleString()}.`,
        severity: 'INFO',
        metadata: {
          auditId: auditRun.id,
          tasksCreated: totalTasksCreated,
          errors: txErrors
        }
      }
    });

    return [runUpdate, txErrors];
  });
  
  errors = finalErrors;

  try {
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (prop) {
      await NotificationEngine.emit({
        type: errors > 0 ? 'NIGHT_AUDIT_DISCREPANCY' : 'NIGHT_AUDIT_COMPLETED',
        organizationId: prop.organizationId,
        propertyId: prop.id,
        entityType: 'night_audit',
        entityId: completedAudit.id,
        idempotencyKey: `night_audit_completed_${completedAudit.id}`,
        metadata: {
          tasksCreated: totalTasksCreated,
          errors: errors
        }
      });
    }
  } catch (notifErr) {
    console.error('[Night Audit] Failed to emit completion notification', notifErr);
  }

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

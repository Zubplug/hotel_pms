import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { lockOrchestrator } from '@/lib/locks/orchestrator';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';
import { requireOrganizationContext } from "@/lib/organization-access";
import { upsertCheckoutHousekeepingTask } from '@/lib/housekeeping-task';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, propertyId: true, corporateAccountId: true, confirmationNumber: true, checkIn: true, checkOut: true, reservationRooms: { include: { room: true } } },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('INVALID_STATE', `Cannot check out a reservation with status ${reservation.status}`, 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Check-out is temporarily paused while Night Audit is posting.', 409);
    }
    const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
    const isNightAuditor = userRole === 'NIGHT_AUDITOR' || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const canCheckOut = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canCheckOut && !isNightAuditor) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // Run the operational checkout transaction
    const txResult = await prisma.$transaction(async (tx: any) => {
      // 1. Verify and Lock Financial State (Check Folios)
      // Note: In Postgres, FOR UPDATE ensures that concurrent transactions modifying these folios are blocked.
      const folios = await tx.$queryRaw<any[]>`
        SELECT id, balance, version, currency
        FROM "Folio" 
        WHERE "reservationId" = ${id}::uuid 
        FOR UPDATE
      `;

      if (reservation.corporateAccountId) {
        const sharedCorporateFolios = await tx.$queryRaw<any[]>`
          SELECT id, balance, version, currency
          FROM "Folio"
          WHERE "corporateAccountId" = ${reservation.corporateAccountId}::uuid
            AND "propertyId" = ${reservation.propertyId}::uuid
            AND "type" = 'CITY_LEDGER'
            AND "status" = 'OPEN'
          FOR UPDATE
        `;
        for (const sharedFolio of sharedCorporateFolios) {
          if (!folios.some((folio: { id: string }) => folio.id === sharedFolio.id)) folios.push(sharedFolio);
        }
      }

      // Day-use/same-day stays must be charged at checkout because they will
      // no longer be CHECKED_IN when Night Audit selects overnight guests.
      // The deterministic operation key prevents a duplicate if another
      // workflow already posted the room charge for this business date.
      const sameDayStay = reservation.checkIn.toISOString().slice(0, 10) === reservation.checkOut.toISOString().slice(0, 10);
      if (sameDayStay && folios.length > 0) {
        const auditKeyPrefix = `ROOM_CHARGE_${reservation.id}_`;
        const chargeAlreadyPosted = await tx.folioItem.findFirst({
          where: {
            folioId: { in: folios.map((folio: { id: string }) => folio.id) },
            source: 'ROOM_CHARGE',
            operationId: { startsWith: auditKeyPrefix },
          },
          select: { id: true },
        });

        if (!chargeAlreadyPosted) {
          const targetFolio = folios[0];
          for (const room of reservation.reservationRooms.filter((item: any) => item.status === 'ACTIVE')) {
            const amount = Number(room.rateAmount || 0);
            if (amount <= 0) continue;
            const operationId = `${auditKeyPrefix}${reservation.checkIn.toISOString().slice(0, 10)}:DAY_USE:${room.id}`;
            await tx.folioItem.create({
              data: {
                folioId: targetFolio.id,
                businessDate: reservation.checkIn,
                type: 'CHARGE',
                source: 'ROOM_CHARGE',
                revenueCategory: 'ROOM',
                description: `Day-use room charge for ${reservation.checkIn.toISOString().slice(0, 10)}`,
                quantity: 1,
                unitAmount: amount,
                amount,
                baseAmount: amount,
                currency: room.currency || targetFolio.currency || 'NGN',
                postedBy: session.user.id,
                operationId,
              },
            });
            await tx.folio.update({
              where: { id: targetFolio.id },
              data: {
                totalCharges: { increment: amount },
                balance: { increment: amount },
                version: { increment: 1 },
              },
            });
            targetFolio.balance = Number(targetFolio.balance) + amount;
            targetFolio.version += 1;
          }
        }
      }

      let totalBalance = 0;
      for (const folio of folios) {
        totalBalance += Number(folio.balance);
      }

      if (totalBalance > 0) {
        if (reservation.corporateAccountId) {
          const corporateAccount = await tx.corporateAccount.findUnique({
            where: { id: reservation.corporateAccountId }
          });
          if (!corporateAccount || !corporateAccount.cityLedgerAccountId) {
            throw new Error('PAYMENT_REQUIRED');
          }
          
          // Automatically route balance to City Ledger
          for (const folio of folios) {
            const amount = Number(folio.balance);
            if (amount > 0) {
              const issueDate = new Date();
              issueDate.setUTCHours(0, 0, 0, 0);
              const dueDate = new Date(issueDate);
              dueDate.setUTCDate(dueDate.getUTCDate() + 30);
              const invoiceNumber = `AR-${reservation.confirmationNumber}-${String(folio.id).slice(0, 8).toUpperCase()}`;
              const invoice = await tx.cityLedgerInvoice.create({
                data: {
                  propertyId: reservation.propertyId,
                  accountId: corporateAccount.cityLedgerAccountId,
                  invoiceNumber,
                  issueDate,
                  dueDate,
                  description: `Corporate folio ${folio.id} for reservation ${reservation.confirmationNumber}`,
                  amount,
                  outstandingAmount: amount,
                  currency: folio.currency || 'NGN',
                  createdBy: session.user.id,
                },
              });
              await tx.cityLedgerEntry.create({
                data: {
                  accountId: corporateAccount.cityLedgerAccountId,
                  propertyId: reservation.propertyId,
                  reservationId: reservation.id,
                  folioId: folio.id,
                  amount,
                  currency: folio.currency || 'NGN',
                  type: 'TRANSFER_IN',
                  reason: 'Auto-routed to City Ledger upon checkout',
                  reference: invoiceNumber,
                  invoiceId: invoice.id,
                  createdBy: session.user.id
                }
              });
              await tx.cityLedgerAccount.update({
                where: { id: corporateAccount.cityLedgerAccountId },
                data: { balance: { increment: amount } },
              });

              await tx.folio.update({
                where: { id: folio.id },
                data: {
                  balance: 0,
                  totalPayments: { increment: amount },
                  version: { increment: 1 }
                }
              });
            }
          }
        } else {
          throw new Error('PAYMENT_REQUIRED');
        }
      } else if (totalBalance < 0) {
        throw new Error('REFUND_REQUIRED');
      }

      // 2. Transition reservation to CHECKED_OUT
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT', checkOut: today },
      });
      await tx.reservationRoom.updateMany({
        where: { reservationId: id },
        data: { checkOut: today },
      });

      // 3. Start room cleaning and create housekeeping tasks
      const businessDate = new Date();
      businessDate.setUTCHours(0, 0, 0, 0); // Simplified business date
      
      let tasksCreated = 0;
      for (const rr of reservation.reservationRooms) {
        if (rr.room) {
          // Check for back-to-back same day arrivals for HIGH priority
          const nextReservation = await tx.reservationRoom.findFirst({
            where: {
              roomId: rr.room.id,
              checkIn: {
                gte: businessDate,
                lt: new Date(businessDate.getTime() + 86400000)
              },
              reservation: { status: 'CONFIRMED' }
            },
            include: { reservation: { include: { priorities: true } } }
          });
          
          let priority = 'NORMAL';
          if (nextReservation) {
            priority = 'HIGH';
            if (nextReservation.reservation.priorities?.some((p: any) => p.type === 'VIP' || p.type === 'MANAGEMENT')) {
              priority = 'CRITICAL';
            }
          }

          await tx.room.update({
            where: { id: rr.room.id },
            data: { status: 'CLEANING', housekeepingStatus: 'CLEANING' },
          });

          // Idempotency: upsert by unique idempotencyKey
          const { task: hskTask } = await upsertCheckoutHousekeepingTask(tx, {
            reservationId: id,
            propertyId: reservation.propertyId,
            roomId: rr.room.id,
            priority,
            businessDate,
            notes: priority === 'HIGH' ? 'Back-to-back arrival expected today.' : null,
          });
          
          if (hskTask.createdAt >= businessDate) { // Rough check if just created
            tasksCreated++;
          }
        }
      }

      // 4. Close the Folios
      for (const folio of folios) {
        await tx.folio.update({
          where: { id: folio.id, version: folio.version },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: session.user.id,
            version: { increment: 1 }
          }
        });
      }

      // 5. Audit Logging
      const property = await tx.property.findUnique({ where: { id: reservation.propertyId } });
      if (property) {
        await tx.auditLog.create({
          data: {
            organizationId: property.organizationId,
            propertyId: property.id,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'STAFF',
            action: 'RESERVATION_CHECKED_OUT',
            resource: 'Reservation',
            resourceId: id,
            newValue: { status: 'CHECKED_OUT', foliosClosed: folios.length, housekeepingTasksQueued: tasksCreated },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          }
        });
      }
      return property;
    });

    if (txResult) {
      await NotificationEngine.emit({
        type: 'CHECK_OUT',
        organizationId: txResult.organizationId,
        propertyId: reservation.propertyId,
        entityType: 'reservation',
        entityId: id,
        idempotencyKey: `checkout_${id}_${Date.now()}`
      });
    }

    // 6. Queue credential revocation (non-blocking)
    let revokedCount = 0;
    try {
      revokedCount = await lockOrchestrator.revokeReservationCredentials(id, reservation.propertyId);
    } catch (hwErr) {
      console.error('[Check-Out] Revocation dispatch failed (non-blocking):', hwErr);
    }

    return successResponse({
      message: 'Check-out complete.',
      revokedCredentials: revokedCount,
      revocationStatus: revokedCount > 0 ? 'QUEUED' : 'NONE',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-Out POST]', err);

    if (message === 'PAYMENT_REQUIRED') {
      return errorResponse('PAYMENT_REQUIRED', 'Guest must settle outstanding balance before check-out.', 402);
    }
    if (message === 'REFUND_REQUIRED') {
      return errorResponse('PAYMENT_REQUIRED', 'Guest has a credit balance. Please process a refund before check-out.', 402);
    }

    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

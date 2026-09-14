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
import { routeFoliosToCityLedger } from '@/lib/finance/route-folio-to-city-ledger';

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
      select: { id: true, status: true, propertyId: true, corporateAccountId: true, primaryGuestId: true, confirmationNumber: true, checkIn: true, checkOut: true, reservationRooms: { include: { room: true } } },
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
      let folios = await tx.$queryRaw<any[]>`
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
        // Corporate guests do not have personal folios. Their charges live only
        // on the company's shared CITY_LEDGER folio.
        folios = sharedCorporateFolios;
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

      const checkoutFolios = reservation.corporateAccountId
        ? await Promise.all(folios.map(async (folio: any) => {
            const items = await tx.folioItem.findMany({
              where: { folioId: folio.id, reservationId: reservation.id, voidedAt: null },
              select: { amount: true },
            });
            return { ...folio, balance: items.reduce((sum: number, item: any) => sum + Number(item.amount), 0) };
          }))
        : folios;
      const totalBalance = checkoutFolios.reduce((sum: number, folio: any) => sum + Number(folio.balance), 0);

      if (reservation.corporateAccountId && Math.abs(totalBalance) > 0.01) {
        await routeFoliosToCityLedger({
          tx,
          folios: checkoutFolios,
          reservationId: reservation.id,
          guestId: reservation.primaryGuestId,
          propertyId: reservation.propertyId,
          corporateAccountId: reservation.corporateAccountId,
          confirmationNumber: reservation.confirmationNumber,
          createdBy: session.user.id,
          keepFolioOpen: Boolean(reservation.corporateAccountId),
        });
      } else if (totalBalance > 0) {
        throw new Error('PAYMENT_REQUIRED');
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
      for (const folio of reservation.corporateAccountId ? [] : folios) {
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

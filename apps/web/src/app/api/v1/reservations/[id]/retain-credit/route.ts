import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { lockOrchestrator } from '@/lib/locks/orchestrator';
import crypto from 'crypto';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason, reasonCode } = body;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return errorResponse('INVALID_REQUEST', 'A retention reason is required.', 400);
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, propertyId: true, primaryGuestId: true, reservationRooms: { include: { room: true } } },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('INVALID_STATE', `Cannot process retention for status ${reservation.status}`, 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Check-out is temporarily paused while Night Audit is posting.', 409);
    }
    const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
    const isNightAuditor = userRole === 'NIGHT_AUDITOR' || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const canCheckOut = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canCheckOut && !isNightAuditor) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const idempotencyKey = req.headers.get('x-idempotency-key') || `SKIPPER_CREDIT_RETENTION_${id}_${crypto.randomUUID()}`;

    const txResult = await prisma.$transaction(async (tx: any) => {
      // 1. Lock Folios and Calculate Net Authoritative Balance
      const folios = await tx.$queryRaw<any[]>`
        SELECT id, balance, version 
        FROM "Folio" 
        WHERE "reservationId" = ${id}::uuid AND status = 'OPEN'
        FOR UPDATE
      `;

      let totalBalance = 0;
      for (const folio of folios) {
        totalBalance += Number(folio.balance);
      }

      // We only retain if the net balance is < 0 (credit)
      if (totalBalance >= 0) {
        throw new Error('INVALID_BALANCE');
      }

      const creditAmount = Math.abs(totalBalance);
      const businessDate = new Date(); // In reality, fetch active night audit date
      businessDate.setUTCHours(0, 0, 0, 0);

      // 2. Zero Out the Folios via Retention Charge and Close Them
      // We apply the retention charge to the first open folio (or distribute it)
      let chargeApplied = false;
      for (const folio of folios) {
        const folioBalance = Number(folio.balance);
        
        if (!chargeApplied && folioBalance < 0) {
          // Post the retention charge to offset the credit
          await tx.folioItem.create({
            data: {
              folioId: folio.id,
              businessDate,
              type: 'CHARGE',
              source: 'MANUAL',
              description: `Retained Credit: ${reasonCode || 'Early Departure'} - ${reason}`,
              quantity: 1,
              unitAmount: Math.abs(folioBalance),
              amount: Math.abs(folioBalance),
              currency: 'NGN',
              baseAmount: Math.abs(folioBalance),
            }
          });
          chargeApplied = true; // Simplified: applying full offset to the main credit folio
        }

        await tx.folio.update({
          where: { id: folio.id, version: folio.version },
          data: {
            balance: 0,
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: session.user.id,
            version: { increment: 1 }
          }
        });
      }

      // 3. Checkout Reservation
      await tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT' },
      });

      // 4. Housekeeping Tasks
      let tasksCreated = 0;
      for (const rr of reservation.reservationRooms) {
        if (rr.room) {
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

          const hskKey = `CHECKOUT_${id}_${rr.room.id}`;
          const hskTask = await tx.housekeepingTask.upsert({
            where: { idempotencyKey: hskKey },
            update: { status: 'CLEANING', startedAt: new Date() },
            create: {
              idempotencyKey: hskKey,
              propertyId: reservation.propertyId,
              roomId: rr.room.id,
              type: 'CHECKOUT',
              priority,
              status: 'CLEANING',
              startedAt: new Date(),
              businessDate,
              notes: priority === 'HIGH' ? 'Back-to-back arrival expected today.' : null
            }
          });
          if (hskTask.createdAt >= businessDate) { tasksCreated++; }
        }
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
            action: 'RESERVATION_CHECKED_OUT_CREDIT_RETAINED',
            resource: 'Reservation',
            resourceId: id,
            newValue: { 
              status: 'CHECKED_OUT', 
              foliosClosed: folios.length, 
              housekeepingTasksQueued: tasksCreated,
              retainedAmount: creditAmount,
              reasonCode: reasonCode || 'EARLY_DEPARTURE',
              reason
            },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
            requestId: idempotencyKey,
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
        idempotencyKey: `checkout_retain_${id}_${Date.now()}`
      });
    }

    let revokedCount = 0;
    try {
      revokedCount = await lockOrchestrator.revokeReservationCredentials(id, reservation.propertyId);
    } catch (hwErr) {
      console.error('[Retain-Credit] Revocation dispatch failed:', hwErr);
    }

    return successResponse({
      message: 'Credit retained and check-out complete.',
      revokedCredentials: revokedCount,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Retain-Credit POST]', err);

    if (message === 'INVALID_BALANCE') {
      return errorResponse('INVALID_BALANCE', 'A credit retention check-out requires a net negative balance (credit).', 400);
    }

    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

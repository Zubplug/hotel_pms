import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { NotificationEngine } from '@/lib/notification-engine';
import { calculateFolioTotals } from '@/lib/finance/folio-totals';
import { applyAvailableFolioCredit } from '@/lib/finance/apply-folio-credit';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { getPropertyBusinessDate } from '@/lib/date-utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const { newCheckoutDate, idempotencyKey } = await req.json();

    if (!newCheckoutDate) return errorResponse('BAD_REQUEST', 'Missing newCheckoutDate', 400);
    if (!idempotencyKey) return errorResponse('BAD_REQUEST', 'Missing idempotencyKey', 400);

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        reservationRooms: {
          include: { room: true }
        },
        property: { select: { organizationId: true, businessDate: true, timezone: true } }
      }
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night audit cutover is in progress. Stay extensions resume after the new business date is active.', 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
    const isNightAuditor = userRole === 'NIGHT_AUDITOR' || userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const canUpdate = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canUpdate && !isNightAuditor) return errorResponse('FORBIDDEN', 'Insufficient permissions to extend stay', 403);

    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('BAD_REQUEST', 'Only checked-in reservations can be extended', 400);
    }

    const resRoom = reservation.reservationRooms[0];
    if (!resRoom) return errorResponse('BAD_REQUEST', 'No room assigned to reservation', 400);

    const currentCheckOut = new Date(resRoom.checkOut);
    const requestedCheckOut = new Date(newCheckoutDate);
    currentCheckOut.setHours(0, 0, 0, 0);
    requestedCheckOut.setHours(0, 0, 0, 0);

    if (requestedCheckOut <= currentCheckOut) {
      return errorResponse('BAD_REQUEST', 'New checkout date must be after current checkout date', 400);
    }
    if (requestedCheckOut <= new Date(reservation.checkIn)) {
      return errorResponse('BAD_REQUEST', 'New checkout date must be after check-in', 400);
    }

    // Idempotency: if we already processed this exact extension, return success
    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        resource: 'Reservation',
        resourceId: reservation.id,
        action: 'RESERVATION_STAY_EXTENDED',
        requestId: idempotencyKey,
      }
    });

    if (existingAudit) {
      return successResponse({ success: true, message: 'Already extended (idempotent)' });
    }

    const timeDiff = requestedCheckOut.getTime() - currentCheckOut.getTime();
    const additionalNights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const currentRate = resRoom.rateAmount;
    const additionalCharge = Number(currentRate) * additionalNights;

    // Availability check for the extension window
    const overlapping = await prisma.reservationRoom.findFirst({
      where: {
        roomId: resRoom.roomId,
        reservationId: { not: reservation.id },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkIn: { lt: requestedCheckOut },
        checkOut: { gt: currentCheckOut },
      }
    });

    if (overlapping) {
      return errorResponse('CONFLICT', 'Room is not available for the extended dates', 409);
    }

    const organizationId = reservation.property.organizationId;
    const propertyId = reservation.propertyId;

    const auditBase = {
      organizationId,
      propertyId,
      userId: session.user.id,
      userEmail: session.user.email || '',
      userRole: (session.user as { role?: string }).role || 'STAFF',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || '',
      requestId: idempotencyKey,
    };

    // Atomic transaction: extend dates + post folio charge
    await prisma.$transaction(async (tx: any) => {
      // 1. Update Reservation checkout
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          checkOut: requestedCheckOut,
          ratePlanSnapshot: {
            ...(reservation.ratePlanSnapshot as any || {}),
            nights: Math.ceil((requestedCheckOut.getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24)),
            total: Number(resRoom.rateAmount) * Math.ceil((requestedCheckOut.getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24)),
          },
        }
      });

      // 2. Update ReservationRoom checkout
      await tx.reservationRoom.update({
        where: { id: resRoom.id },
        data: { checkOut: requestedCheckOut }
      });

      // 3. Find folio to apply credit if needed
      const folio = await tx.folio.findFirst({
        where: { reservationId: reservation.id }
      });

      if (folio) {
        await applyAvailableFolioCredit(tx, {
          folioId: folio.id,
          propertyId: reservation.propertyId,
          guestId: reservation.primaryGuestId,
          reservationId: reservation.id,
          amount: additionalNights * Number(currentRate),
          currency: resRoom.currency,
          source: 'ROOM_EXTENSION',
          description: `Applied guest credit to room extension - ${additionalNights} night${additionalNights === 1 ? '' : 's'}`,
          appliedBy: session.user.id,
          operationKey: idempotencyKey
          ,businessDate: reservation.property.businessDate || getPropertyBusinessDate(reservation.property.timezone)
        });
      }

      // 4. Write audit logs
      await tx.auditLog.create({
        data: {
          ...auditBase,
          action: 'RESERVATION_STAY_EXTENDED',
          resource: 'Reservation',
          resourceId: reservation.id,
          previousValue: { checkOut: currentCheckOut },
          newValue: {
            checkOut: requestedCheckOut,
            additionalNights,
            additionalCharge,
          },
        }
      });

    });

    await NotificationEngine.emit({
      type: 'STAY_EXTENDED',
      organizationId,
      propertyId,
      entityType: 'reservation',
      entityId: id,
      idempotencyKey: `stay_extended_${id}_${requestedCheckOut.getTime()}`,
    });

    return successResponse({ success: true });

  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'FORBIDDEN') return errorResponse('FORBIDDEN', (err as Error).message, 403);
    console.error('[Extend POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

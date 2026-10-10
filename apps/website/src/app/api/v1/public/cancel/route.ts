import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolvePublicApiContext,
  isErrorResponse,
  checkRateLimit,
  rateLimitIdentity,
} from '@/lib/booking-engine/middleware';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { NotificationEngine } from '@/lib/notification-engine';
import { sendBookingCancellationEmail } from '@/lib/email/booking-emails';
import { queueBookingRefundRequests } from '@/lib/booking-engine/refund-service';
import { CancelReservationRequestSchema } from '@hotel-pms/types';

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const ip = rateLimitIdentity(req);
  if (!(await checkRateLimit(ip, 'cancel'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsedBody = CancelReservationRequestSchema.safeParse(body);
  if (!parsedBody.success) return errorResponse('BAD_REQUEST', 'Invalid cancellation payload', 400, parsedBody.error.flatten());
  const { cancelToken, reason } = parsedBody.data;

  const tokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex');

  const reservation = await prisma.reservation.findFirst({
    where: {
      propertyId: ctx.propertyId,
      guestCancellationTokenHash: tokenHash,
    },
    include: {
      primaryGuest: { select: { firstName: true, lastName: true, email: true } },
      reservationRooms: true,
      cancellationPolicy: true,
      folios: {
        where: { type: 'ROOM', status: 'OPEN' },
        take: 1,
        include: { payments: { include: { refunds: true } } },
      },
      property: { select: { id: true, organizationId: true, businessDate: true, timezone: true, name: true } },
    },
  });

  if (!reservation) {
    const res = errorResponse('NOT_FOUND', 'Reservation not found or cancel token is invalid', 404);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) {
    const res = errorResponse(
      'CONFLICT',
      `Reservation cannot be cancelled — current status is ${reservation.status}`,
      409
    );
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  if (reservation.status === 'CHECKED_IN') {
    const res = errorResponse('CONFLICT', 'In-house reservations cannot be cancelled online', 409);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const policy = reservation.cancellationPolicy;
  let penaltyAmount = 0;
  let penaltyDescription = 'No penalty';

  if (policy) {
    const hoursUntilCheckIn = Math.max(
      0,
      (new Date(reservation.checkIn).getTime() - Date.now()) / 3_600_000
    );
    const isPenaltyWindow = hoursUntilCheckIn < policy.hoursBeforeCheckIn;
    const snapshot = reservation.ratePlanSnapshot as any;
    const subtotal = snapshot?.subtotal ?? 0;

    if (isPenaltyWindow && policy.penaltyType !== 'NONE') {
      switch (policy.penaltyType) {
        case 'FIRST_NIGHT': {
          const nights = Math.ceil(
            (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / 86_400_000
          );
          penaltyAmount = subtotal / nights;
          penaltyDescription = 'First night charge applies';
          break;
        }
        case 'PERCENTAGE':
          penaltyAmount = subtotal * (Number(policy.penaltyValue) / 100);
          penaltyDescription = `${policy.penaltyValue}% cancellation fee applies`;
          break;
        case 'FLAT':
          penaltyAmount = Number(policy.penaltyValue);
          penaltyDescription = `Flat cancellation fee of ${reservation.currency} ${policy.penaltyValue}`;
          break;
      }
      penaltyAmount = Math.round(penaltyAmount * 100) / 100;
    }
  }

  const systemActorId = await getOrCreateBookingSystemActor(
    prisma as any,
    ctx.organizationId
  );

  const refundRequests = await prisma.$transaction(async (tx) => {
    await (tx as any).reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: systemActorId,
        cancellationReason: reason || 'Guest self-service cancellation via Public API',
      },
    });

    await (tx as any).reservationRoom.updateMany({
      where: { reservationId: reservation.id },
      data: { status: 'CANCELLED' },
    });

    for (const reservationRoom of reservation.reservationRooms) {
      if (!reservationRoom.roomId) continue;
      const otherActive = await (tx as any).reservationRoom.findFirst({
        where: {
          roomId: reservationRoom.roomId,
          status: 'ACTIVE',
          reservationId: { not: reservation.id },
          checkIn: { lt: reservation.checkOut },
          checkOut: { gt: reservation.checkIn },
        },
      });
      if (!otherActive) await (tx as any).room.update({ where: { id: reservationRoom.roomId }, data: { status: 'AVAILABLE' } });
    }

    const queuedRefundRequests = await queueBookingRefundRequests({
      tx,
      reservation,
      property: reservation.property,
      totalPaid: reservation.folios.reduce((sum: number, folio: any) => sum + folio.payments.reduce((inner: number, payment: any) => inner + Number(payment.amount), 0), 0),
      cancellationPenalty: penaltyAmount,
      reason: `${reason || 'Guest self-service cancellation'}${penaltyAmount > 0 ? `; cancellation policy penalty applied: ${penaltyAmount.toFixed(2)}` : ''}`,
    });

    await (tx as any).auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        userId: systemActorId,
        userEmail: 'booking.system@lodgecore.internal',
        userRole: 'GUEST',
        action: 'RESERVATION_CANCELLED',
        resource: 'Reservation',
        resourceId: reservation.id,
        newValue: {
          status: 'CANCELLED',
          cancelledVia: 'PUBLIC_API',
          penaltyAmount,
          reason: reason || 'Guest self-service',
        },
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') ?? 'Unknown',
        requestId: crypto.randomUUID(),
      },
    });

    return queuedRefundRequests;
  });

  if (reservation.primaryGuest.email) {
    const refundableAmount = refundRequests.reduce((sum: number, request: any) => sum + Number(request.requestedAmount || 0), 0);
    sendBookingCancellationEmail({
      to: reservation.primaryGuest.email,
      propertyName: reservation.property.name,
      confirmationNumber: reservation.confirmationNumber,
      penaltyAmount,
      currency: reservation.currency,
      refundAmount: refundableAmount,
      refundPending: refundableAmount > 0,
    }).catch((e) => console.error('[Booking Cancel] guest email failed', e));
  }

  NotificationEngine.emit({
    type: 'RESERVATION_CANCELLED',
    organizationId: ctx.organizationId,
    propertyId: ctx.propertyId,
    entityType: 'reservation',
    entityId: reservation.id,
    metadata: {
      reason: reason || 'Guest self-service cancellation',
      bookingValue: (reservation.ratePlanSnapshot as any)?.subtotal ?? 0,
      source: 'PUBLIC_API',
    },
  }).catch((e: any) => console.error('[Booking Cancel] Notification failed:', e));

  const res = successResponse(
    {
      cancelled: true,
      confirmationNumber: reservation.confirmationNumber,
      penaltyAmount,
      penaltyDescription,
      refundRequestsQueued: refundRequests.map((request: any) => ({
        id: request.id,
        amount: Number(request.requestedAmount),
        currency: request.currency,
        status: request.status,
      })),
      refundNote:
        refundRequests.length > 0
          ? 'A refund request has been submitted for property approval and processing.'
          : penaltyAmount > 0
            ? 'The cancellation charge covers the eligible payment; no refund request was created.'
            : 'No refundable online payment was found for this reservation.',
    },
    200
  );
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

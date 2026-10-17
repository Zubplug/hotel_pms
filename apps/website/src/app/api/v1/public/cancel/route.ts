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
import { calculateCancellationQuote } from '@/lib/booking-engine/cancellation-service';
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
  const { cancelToken, confirmationNumber, guestEmail, reason } = parsedBody.data;
  const preview = body?.preview === true;

  const tokenHash = cancelToken ? crypto.createHash('sha256').update(cancelToken).digest('hex') : null;

  const reservation = await prisma.reservation.findFirst({
    where: tokenHash
      ? { propertyId: ctx.propertyId, guestCancellationTokenHash: tokenHash }
      : guestEmail
        ? { propertyId: ctx.propertyId, ...(confirmationNumber ? { confirmationNumber } : {}), primaryGuest: { email: { equals: guestEmail, mode: 'insensitive' as const } } }
        : { propertyId: ctx.propertyId, confirmationNumber },
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

  const cancellationQuote = calculateCancellationQuote(reservation);
  const { penaltyAmount, penaltyDescription } = cancellationQuote;
  if (preview) {
    const response = successResponse({ confirmationNumber: reservation.confirmationNumber, currency: reservation.currency, checkIn: reservation.checkIn, checkOut: reservation.checkOut, ...cancellationQuote, canCancel: true }, 200);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => response.headers.set(k, v));
    return response;
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

    if (penaltyAmount > 0 && reservation.folios[0]) {
      const operationId = `BOOKING_CANCEL_PENALTY_${reservation.id}`;
      const existingPenalty = await (tx as any).folioItem.findFirst({ where: { operationId } });
      if (!existingPenalty) {
        await (tx as any).folioItem.create({ data: {
          folioId: reservation.folios[0].id,
          reservationId: reservation.id,
          guestId: reservation.primaryGuestId,
          businessDate: reservation.property.businessDate || new Date(),
          type: 'CHARGE',
          source: 'ROOM_CHARGE',
          revenueCategory: 'ROOM',
          description: `Cancellation fee — ${penaltyDescription}`,
          quantity: 1,
          unitAmount: penaltyAmount,
          amount: penaltyAmount,
          currency: reservation.currency,
          baseAmount: penaltyAmount,
          postedBy: systemActorId,
          operationId,
        } });
        await (tx as any).folio.update({ where: { id: reservation.folios[0].id }, data: { totalCharges: { increment: penaltyAmount }, balance: { increment: penaltyAmount } } });
      }
    }

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
      notificationType: 'RESERVATION_CANCELLED',
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
      refundableAmount: cancellationQuote.refundableAmount,
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

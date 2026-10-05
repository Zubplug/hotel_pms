// POST /api/public/booking/[slug]/cancel
// Guest self-service cancellation using the opaque cancel token.
// Applies the cancellation policy and updates the reservation status.

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolveBookingContext,
  isErrorResponse,
  checkRateLimit,
  clientIp,
} from '@/lib/booking-engine/middleware';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { NotificationEngine } from '@/lib/notification-engine';
import { sendBookingCancellationEmail } from '@/lib/email/booking-emails';
import { queueBookingRefundRequests } from '@/lib/booking-engine/refund-service';

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolveBookingContext(slug);
  if (isErrorResponse(ctx)) return ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const { cancelToken, reason } = body;
  if (!cancelToken) {
    return errorResponse('BAD_REQUEST', 'cancelToken is required', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex');

  const reservation = await prisma.reservation.findFirst({
    where: {
      propertyId: ctx.property.id,
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
      property: { select: { id: true, organizationId: true, businessDate: true, timezone: true } },
    },
  });

  if (!reservation) {
    const res = errorResponse('NOT_FOUND', 'Reservation not found or cancel token is invalid', 404);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Guard: can only cancel CONFIRMED or PENDING reservations
  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) {
    const res = errorResponse(
      'CONFLICT',
      `Reservation cannot be cancelled — current status is ${reservation.status}`,
      409
    );
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Guard: cannot cancel a reservation that has already checked in
  if (reservation.status === 'CHECKED_IN') {
    const res = errorResponse('CONFLICT', 'In-house reservations cannot be cancelled online', 409);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Determine cancellation policy penalty
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
    ctx.property.organizationId
  );

  // Perform cancellation in a transaction
  const refundRequests = await prisma.$transaction(async (tx) => {
    // Update reservation
    await (tx as any).reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: systemActorId,
        cancellationReason: reason || 'Guest self-service cancellation via Booking Engine',
      },
    });

    // Cancel all reservation rooms
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

    // Audit log
    await (tx as any).auditLog.create({
      data: {
        organizationId: ctx.property.organizationId,
        propertyId: ctx.property.id,
        userId: systemActorId,
        userEmail: 'booking.system@lodgecore.internal',
        userRole: 'GUEST',
        action: 'RESERVATION_CANCELLED',
        resource: 'Reservation',
        resourceId: reservation.id,
        newValue: {
          status: 'CANCELLED',
          cancelledVia: 'BOOKING_ENGINE',
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
    sendBookingCancellationEmail({
      to: reservation.primaryGuest.email,
      propertyName: ctx.property.name,
      confirmationNumber: reservation.confirmationNumber,
      penaltyAmount,
      currency: reservation.currency,
    }).catch((e) => console.error('[Booking Cancel] guest email failed', e));
  }

  // Staff notification (fire and forget)
  NotificationEngine.emit({
    type: 'RESERVATION_CANCELLED',
    organizationId: ctx.property.organizationId,
    propertyId: ctx.property.id,
    entityType: 'reservation',
    entityId: reservation.id,
    metadata: {
      reason: reason || 'Guest self-service cancellation',
      bookingValue: (reservation.ratePlanSnapshot as any)?.subtotal ?? 0,
      source: 'BOOKING_ENGINE',
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
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

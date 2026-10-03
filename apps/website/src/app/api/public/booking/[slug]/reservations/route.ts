// POST /api/public/booking/[slug]/reservations
// Converts an active BookingHold into a confirmed Reservation.
// Idempotent via X-Idempotency-Key header (maps to BookingRequest).

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
import { AuthoritativeAvailabilityService } from '@/lib/booking-engine/availability-service';
import { ReservationPricingService } from '@/lib/booking-engine/pricing-service';
import { SharedReservationService } from '@/lib/services/reservation-service';
import { NotificationEngine } from '@/lib/notification-engine';
import { sendBookingConfirmationEmail } from '@/lib/email/booking-emails';
import { resolveBookingOrigin } from '@/lib/booking-engine/request-origin';

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

  // Idempotency key — required, client-generated UUID per booking attempt
  const idempotencyKey = req.headers.get('x-idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16) {
    return errorResponse('BAD_REQUEST', 'X-Idempotency-Key header is required', 400);
  }

  const ctx = await resolveBookingContext(slug);
  if (isErrorResponse(ctx)) return ctx;

  // ── Idempotency check (fast pre-check, no lock) ───────────────────────────
  const existingRequest = await prisma.bookingRequest.findUnique({
    where: { idempotencyKey },
  });
  if (existingRequest) {
    if (existingRequest.status === 'COMPLETED' && existingRequest.reservationId) {
      const res = await prisma.reservation.findUnique({
        where: { id: existingRequest.reservationId },
        select: { confirmationNumber: true, status: true },
      });
      return successResponse(
        { confirmationNumber: res?.confirmationNumber, status: res?.status, idempotent: true },
        200
      );
    }
    if (existingRequest.status === 'PROCESSING') {
      return errorResponse('CONFLICT', 'A booking with this idempotency key is already being processed', 409);
    }
    if (existingRequest.status === 'FAILED') {
      return errorResponse('UNPROCESSABLE', existingRequest.errorMessage ?? 'Previous attempt failed', 422);
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const {
    holdToken,
    guest: guestInput,
    ratePlanId,
    specialRequests,
  } = body;

  if (!holdToken || !guestInput?.firstName || !guestInput?.lastName) {
    return errorResponse('BAD_REQUEST', 'holdToken, guest.firstName, guest.lastName are required', 400);
  }

  // ── Validate hold token ──────────────────────────────────────────────────
  const tokenHash = crypto.createHash('sha256').update(holdToken).digest('hex');
  const hold = await prisma.bookingHold.findFirst({
    where: { tokenHash, propertyId: ctx.property.id, status: 'ACTIVE' },
  });

  if (!hold) {
    return errorResponse('NOT_FOUND', 'Hold not found or token is invalid', 404);
  }
  if (hold.expiresAt < new Date()) {
    return errorResponse('GONE', 'This hold has expired. Please search again and restart your booking', 410);
  }
  if (hold.propertyId !== ctx.property.id) {
    return errorResponse('FORBIDDEN', 'Hold does not belong to this property', 403);
  }

  // ── Mark BookingRequest as PROCESSING (idempotency lock) ─────────────────
  try {
    await prisma.bookingRequest.create({
      data: {
        idempotencyKey,
        propertyId: ctx.property.id,
        status: 'PROCESSING',
      },
    });
  } catch {
    // Race: another request already created it — treat as conflict
    return errorResponse('CONFLICT', 'A booking with this idempotency key is already being processed', 409);
  }

  let reservationId: string | null = null;
  let confirmationNumber: string | null = null;

  try {
    // ── Transactional reservation creation ───────────────────────────────
    const newReservation = await prisma.$transaction(
      async (tx) => {
        // 1. Re-assert availability (excludes this hold from the count)
        await AuthoritativeAvailabilityService.assertAvailable(tx as any, {
          propertyId: ctx.property.id,
          roomTypeId: hold.roomTypeId,
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          excludeHoldId: hold.id,
        });

        // 2. Verify snapshot is still valid (detect rate drift)
        const snapshot = hold.quoteSnapshot as any;
        const stillValid = await ReservationPricingService.isSnapshotStillValid(tx as any, snapshot, {
          propertyId: ctx.property.id,
          paymentMode: ctx.config.paymentMode,
        });
        // If price has changed we still proceed but record it — the guest already
        // accepted the quoted price when they placed the hold.
        const finalSnapshot = snapshot;

        // 3. Find or create guest record
        let guestId: string | undefined;
        if (guestInput.email) {
          const existingGuest = await (tx as any).guest.findFirst({
            where: {
              organizationId: ctx.property.organizationId,
              email: guestInput.email,
            },
            select: { id: true },
          });
          if (existingGuest) guestId = existingGuest.id;
        }

        // 4. Create reservation (PAY_LATER → CONFIRMED, payment modes with deposit → PENDING)
        const reservationStatus =
          ctx.config.paymentMode === 'PAY_LATER' ? 'CONFIRMED' : 'PENDING';

        // 5. Generate secure guest-facing tokens (SHA-256 hashed in DB)
        const rawConfirmToken = crypto.randomBytes(32).toString('hex');
        const rawCancelToken = crypto.randomBytes(32).toString('hex');
        const confirmHash = crypto.createHash('sha256').update(rawConfirmToken).digest('hex');
        const cancelHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');

        const res = await SharedReservationService.createReservation({
          propertyId: ctx.property.id,
          organizationId: ctx.property.organizationId,
          guestId,
          guestDetails: guestId ? undefined : {
            firstName: guestInput.firstName,
            lastName: guestInput.lastName,
            email: guestInput.email,
            phone: guestInput.phone,
            country: guestInput.country,
          },
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          roomTypeId: hold.roomTypeId,
          adults: body.adults ?? 1,
          children: body.children ?? 0,
          ratePlanId: finalSnapshot.ratePlanId,
          overrideTotalAmount: finalSnapshot.subtotal,
          currency: finalSnapshot.currency,
          source: 'WEBSITE',
          status: reservationStatus,
          specialRequests: specialRequests ?? null,
          // Guest-created reservations intentionally have no staff creator.
          // The system Staff actor is reserved for accounting/audit actions.
          createdBy: undefined,
          createdByType: 'GUEST',
          userEmail: guestInput.email ?? 'guest@booking.lodgecore.com',
          userRole: 'GUEST',
          tx: tx as any,
        });

        // 6. Write token hashes + booking channel ref onto the reservation
        await (tx as any).reservation.update({
          where: { id: res.id },
          data: {
            ratePlanSnapshot: finalSnapshot,
            bookingChannelRef: hold.id,
            guestConfirmationTokenHash: confirmHash,
            guestCancellationTokenHash: cancelHash,
          },
        });

        // 7. Convert the hold
        await (tx as any).bookingHold.update({
          where: { id: hold.id },
          data: { status: 'CONVERTED' },
        });

        return {
          reservation: res,
          confirmToken: rawConfirmToken,
          cancelToken: rawCancelToken,
          priceValid: stillValid,
        };
      },
      { isolationLevel: 'RepeatableRead' }
    );

    reservationId = newReservation.reservation.id;
    confirmationNumber = newReservation.reservation.confirmationNumber;

    // ── Mark BookingRequest COMPLETED ────────────────────────────────────
    await prisma.bookingRequest.update({
      where: { idempotencyKey },
      data: { status: 'COMPLETED', reservationId },
    });

    // ── Staff in-app notification (fire and forget) ───────────────────────
    NotificationEngine.emit({
      type: 'RESERVATION_CREATED',
      organizationId: ctx.property.organizationId,
      propertyId: ctx.property.id,
      entityType: 'reservation',
      entityId: reservationId!,
      idempotencyKey: `BOOKING_ENGINE_${reservationId}`,
      metadata: { source: 'WEBSITE', bookingValue: (hold.quoteSnapshot as any).subtotal },
    }).catch((e: any) => console.error('[Booking] Notification failed:', e));

    if (guestInput.email) {
      sendBookingConfirmationEmail({
        to: guestInput.email,
        firstName: guestInput.firstName,
        propertyName: ctx.property.name,
        confirmationNumber: confirmationNumber!,
        checkIn: hold.checkIn,
        checkOut: hold.checkOut,
        roomTypeName: (hold.quoteSnapshot as any)?.roomTypeName ?? 'Room',
        total: Number((hold.quoteSnapshot as any)?.subtotal ?? 0),
        currency: (hold.quoteSnapshot as any)?.currency ?? ctx.property.currency,
        manageUrl: `${resolveBookingOrigin(req.headers, process.env.NEXT_PUBLIC_BOOKING_URL)}/book/${slug}/confirmation?token=${newReservation.confirmToken}`,
      }).catch((e) => console.error('[Booking] confirmation email failed', e));
    }

    const res = successResponse(
      {
        confirmationNumber,
        status: ctx.config.paymentMode === 'PAY_LATER' ? 'CONFIRMED' : 'PENDING',
        confirmationToken: newReservation.confirmToken,
        cancellationToken: newReservation.cancelToken,
        priceChanged: !newReservation.priceValid,
        paymentRequired: ctx.config.paymentMode !== 'PAY_LATER',
        depositAmount: (hold.quoteSnapshot as any).depositAmount ?? 0,
      },
      201
    );
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    // ── Mark BookingRequest FAILED ────────────────────────────────────────
    await prisma.bookingRequest
      .update({
        where: { idempotencyKey },
        data: { status: 'FAILED', errorMessage: err.message },
      })
      .catch(() => null);

    if (err.code === 'BOOKING_UNAVAILABLE') {
      const res = errorResponse('CONFLICT', 'No availability for the selected room type and dates', 409);
      Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    console.error('[Booking Reservations POST]', err);
    const res = errorResponse('INTERNAL_ERROR', 'Could not create reservation', 500);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}


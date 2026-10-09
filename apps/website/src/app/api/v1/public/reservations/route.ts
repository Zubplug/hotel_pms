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
  clientIp,
} from '@/lib/booking-engine/middleware';
import { AuthoritativeAvailabilityService } from '@/lib/booking-engine/availability-service';
import { ReservationPricingService } from '@/lib/booking-engine/pricing-service';
import { SharedReservationService } from '@/lib/services/reservation-service';
import { NotificationEngine } from '@/lib/notification-engine';
import { sendBookingConfirmationEmail } from '@/lib/email/booking-emails';
import { resolveBookingOrigin } from '@/lib/booking-engine/request-origin';
import { CreateReservationRequestSchema } from '@hotel-pms/types';

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await checkRateLimit(ip, 'reservations'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const idempotencyKey = req.headers.get('x-idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16) {
    return errorResponse('BAD_REQUEST', 'X-Idempotency-Key header is required', 400);
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  const config = await prisma.bookingEngineConfig.findUnique({
    where: { propertyId: ctx.propertyId },
    include: { property: { select: { id: true, name: true, organizationId: true, baseCurrency: true } } }
  });

  if (!config || !config.enabled) {
    return errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
  }
  const property = config.property;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsedBody = CreateReservationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return errorResponse('BAD_REQUEST', 'Invalid reservation payload', 400, parsedBody.error.flatten());
  }
  const {
    holdToken,
    guest: guestInput,
    specialRequests,
    adults,
    children,
  } = parsedBody.data;

  const tokenHash = crypto.createHash('sha256').update(holdToken).digest('hex');
  const hold = await prisma.bookingHold.findFirst({
    where: { tokenHash, propertyId: ctx.propertyId, status: 'ACTIVE' },
  });

  if (!hold) {
    return errorResponse('NOT_FOUND', 'Hold not found or token is invalid', 404);
  }
  if (hold.expiresAt < new Date()) {
    return errorResponse('GONE', 'This hold has expired. Please search again and restart your booking', 410);
  }

  try {
    await prisma.bookingRequest.create({
      data: {
        idempotencyKey,
        propertyId: ctx.propertyId,
        status: 'PROCESSING',
      },
    });
  } catch {
    return errorResponse('CONFLICT', 'A booking with this idempotency key is already being processed', 409);
  }

  let reservationId: string | null = null;
  let confirmationNumber: string | null = null;

  try {
    const newReservation = await prisma.$transaction(
      async (tx) => {
        await AuthoritativeAvailabilityService.assertAvailable(tx as any, {
          propertyId: ctx.propertyId,
          roomTypeId: hold.roomTypeId,
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          excludeHoldId: hold.id,
        });

        const assignedRoom = await AuthoritativeAvailabilityService.findAssignableRoom(tx as any, {
          propertyId: ctx.propertyId,
          roomTypeId: hold.roomTypeId,
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
        });
        if (!assignedRoom) {
          const unavailable = new Error('No physical room is available for the selected dates');
          (unavailable as any).code = 'BOOKING_UNAVAILABLE';
          throw unavailable;
        }

        const snapshot = hold.quoteSnapshot as any;
        const stillValid = await ReservationPricingService.isSnapshotStillValid(tx as any, snapshot, {
          propertyId: ctx.propertyId,
          paymentMode: config.paymentMode,
        });
        const finalSnapshot = snapshot;

        let guestId: string | undefined;
        if (guestInput.email) {
          const existingGuest = await (tx as any).guest.findFirst({
            where: {
              organizationId: ctx.organizationId,
              email: guestInput.email,
            },
            select: { id: true },
          });
          if (existingGuest) guestId = existingGuest.id;
        }

        const reservationStatus =
          config.paymentMode === 'PAY_LATER' ? 'CONFIRMED' : 'PENDING';

        const rawConfirmToken = crypto.randomBytes(32).toString('hex');
        const rawCancelToken = crypto.randomBytes(32).toString('hex');
        const confirmHash = crypto.createHash('sha256').update(rawConfirmToken).digest('hex');
        const cancelHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');

        const res = await SharedReservationService.createReservation({
          propertyId: ctx.propertyId,
          organizationId: ctx.organizationId,
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
          roomId: assignedRoom.id,
          adults,
          children,
          ratePlanId: finalSnapshot.ratePlanId,
          overrideTotalAmount: finalSnapshot.subtotal,
          currency: finalSnapshot.currency,
          source: 'WEBSITE', // Or from IntegrationContext
          status: reservationStatus,
          specialRequests: specialRequests ?? undefined,
          createdBy: undefined,
          createdByType: 'GUEST',
          userEmail: guestInput.email ?? 'guest@booking.lodgecore.com',
          userRole: 'GUEST',
          tx: tx as any,
        });

        await (tx as any).reservation.update({
          where: { id: res.id },
          data: {
            ratePlanSnapshot: finalSnapshot,
            bookingChannelRef: hold.id,
            guestConfirmationTokenHash: confirmHash,
            guestCancellationTokenHash: cancelHash,
          },
        });

        await (tx as any).bookingHold.update({
          where: { id: hold.id },
          data: { status: 'CONVERTED' },
        });

        return {
          reservation: res,
          assignedRoomNumber: assignedRoom.number,
          confirmToken: rawConfirmToken,
          cancelToken: rawCancelToken,
          priceValid: stillValid,
        };
      },
      { isolationLevel: 'Serializable' }
    );

    reservationId = newReservation.reservation.id;
    confirmationNumber = newReservation.reservation.confirmationNumber;

    await prisma.bookingRequest.update({
      where: { idempotencyKey },
      data: { status: 'COMPLETED', reservationId },
    });

    NotificationEngine.emit({
      type: 'RESERVATION_CREATED',
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId,
      entityType: 'reservation',
      entityId: reservationId!,
      idempotencyKey: `BOOKING_ENGINE_${reservationId}`,
      metadata: { source: 'WEBSITE', bookingValue: (hold.quoteSnapshot as any).subtotal },
    }).catch((e: any) => console.error('[Booking] Notification failed:', e));

    if (guestInput.email) {
      sendBookingConfirmationEmail({
        to: guestInput.email,
        firstName: guestInput.firstName,
        propertyName: property.name,
        confirmationNumber: confirmationNumber!,
        checkIn: hold.checkIn,
        checkOut: hold.checkOut,
        roomTypeName: (hold.quoteSnapshot as any)?.roomTypeName ?? 'Room',
        total: Number((hold.quoteSnapshot as any)?.subtotal ?? 0),
        currency: (hold.quoteSnapshot as any)?.currency ?? property.baseCurrency,
        roomNumber: newReservation.assignedRoomNumber,
        paymentRequired: config.paymentMode !== 'PAY_LATER',
        manageUrl: `${resolveBookingOrigin(req.headers, process.env.NEXT_PUBLIC_BOOKING_URL)}/reservation?token=${newReservation.confirmToken}`,
      }).catch((e) => console.error('[Booking] confirmation email failed', e));
    }

    const res = successResponse(
      {
        confirmationNumber,
        roomNumber: newReservation.assignedRoomNumber,
        status: config.paymentMode === 'PAY_LATER' ? 'CONFIRMED' : 'PENDING',
        confirmationToken: newReservation.confirmToken,
        cancellationToken: newReservation.cancelToken,
        priceChanged: !newReservation.priceValid,
        paymentRequired: config.paymentMode !== 'PAY_LATER',
        depositAmount: (hold.quoteSnapshot as any).depositAmount ?? 0,
      },
      201
    );
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    await prisma.bookingRequest
      .update({
        where: { idempotencyKey },
        data: { status: 'FAILED', errorMessage: err.message },
      })
      .catch(() => null);

    if (err.code === 'BOOKING_UNAVAILABLE') {
      const res = errorResponse('CONFLICT', 'No availability for the selected room type and dates', 409);
      Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    console.error('[Booking Reservations POST]', err);
    const res = errorResponse('INTERNAL_ERROR', 'Could not create reservation', 500);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}

// POST /api/v1/public/hold
//
// Places a short-lived (12-minute) inventory hold for a room type.
// Must be called before POST /api/v1/public/reservations.
// Returns an opaque hold token the client must pass to the reservation endpoint.
//
// Authentication: X-Publishable-Key header (Standalone API add-on)
// CORS: enforced against the key's allowedOrigins

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
import { CreateHoldRequestSchema } from '@hotel-pms/types';

const HOLD_TTL_MINUTES = 12;

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await checkRateLimit(ip, 'hold'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  // Verify the booking engine is enabled for this property
  const config = await prisma.bookingEngineConfig.findUnique({
    where: { propertyId: ctx.propertyId },
    select: {
      enabled: true,
      paymentMode: true,
      allowedRatePlanIds: true,
      minStay: true,
      maxStay: true,
      bookingLeadTimeHours: true,
      maxAdvanceDays: true,
    },
  });

  if (!config || !config.enabled) {
    const res = errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const parsedBody = CreateHoldRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    const res = errorResponse('BAD_REQUEST', 'Invalid hold payload', 400, parsedBody.error.flatten());
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const { roomTypeId, ratePlanId, checkIn: checkInStr, checkOut: checkOutStr } = parsedBody.data;

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);

  // Date sanity checks
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    const res = errorResponse('BAD_REQUEST', 'checkOut must be after checkIn', 400);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

  // Enforce booking engine constraints
  if (nights < config.minStay) {
    const res = errorResponse('BAD_REQUEST', `Minimum stay is ${config.minStay} night(s)`, 400);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  if (config.maxStay && nights > config.maxStay) {
    const res = errorResponse('BAD_REQUEST', `Maximum stay is ${config.maxStay} night(s)`, 400);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  if (config.bookingLeadTimeHours > 0) {
    const earliestCheckIn = new Date(Date.now() + config.bookingLeadTimeHours * 3_600_000);
    if (checkIn < earliestCheckIn) {
      const res = errorResponse(
        'BAD_REQUEST',
        `Bookings must be made at least ${config.bookingLeadTimeHours} hour(s) in advance`,
        400
      );
      Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
  }
  if (config.maxAdvanceDays) {
    const latestCheckIn = new Date(Date.now() + config.maxAdvanceDays * 86_400_000);
    if (checkIn > latestCheckIn) {
      const res = errorResponse(
        'BAD_REQUEST',
        `Bookings cannot be made more than ${config.maxAdvanceDays} days in advance`,
        400
      );
      Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
  }

  // Validate the room type belongs to this property and is active
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId: ctx.propertyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!roomType) {
    const res = errorResponse('NOT_FOUND', 'Room type not found', 404);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Validate the rate plan is active, public, and accessible for this property
  const ratePlanWhere: any = {
    id: ratePlanId,
    propertyId: ctx.propertyId,
    isActive: true,
    isPublic: true,
    deletedAt: null,
  };
  if (config.allowedRatePlanIds.length > 0 && !config.allowedRatePlanIds.includes(ratePlanId)) {
    const res = errorResponse('NOT_FOUND', 'Rate plan not available for online booking', 404);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  const ratePlan = await prisma.ratePlan.findFirst({
    where: ratePlanWhere,
    select: { id: true },
  });
  if (!ratePlan) {
    const res = errorResponse('NOT_FOUND', 'Rate plan not found', 404);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // CRITICAL: Availability check + hold creation in a single serializable transaction
  // to prevent concurrent overbooking at the room-type level.
  // The DB exclusion constraint only covers roomId (physical rooms); room-type
  // overbooking is prevented entirely at the application layer here.
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Assert availability — throws BOOKING_UNAVAILABLE if sold out
        await AuthoritativeAvailabilityService.assertAvailable(tx as any, {
          propertyId: ctx.propertyId,
          roomTypeId,
          checkIn,
          checkOut,
        });

        // 2. Build the immutable price snapshot for this hold
        const quote = await ReservationPricingService.quote(tx as any, {
          propertyId: ctx.propertyId,
          ratePlanId,
          roomTypeId,
          checkIn,
          checkOut,
          paymentMode: config.paymentMode,
        });

        // 3. Generate the opaque hold token — raw token goes to guest, SHA-256 hash stored in DB
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000);

        // 4. Persist the hold
        const hold = await (tx as any).bookingHold.create({
          data: {
            organizationId: ctx.organizationId,
            propertyId: ctx.propertyId,
            roomTypeId,
            checkIn,
            checkOut,
            quantity: 1,
            tokenHash,
            status: 'ACTIVE',
            expiresAt,
            quoteSnapshot: quote.snapshot as any,
          },
          select: { id: true, expiresAt: true },
        });

        return { hold, rawToken, quote };
      },
      // RepeatableRead prevents double-counting concurrent holds and reservations
      { isolationLevel: 'RepeatableRead' }
    );

    const res = successResponse(
      {
        holdToken: result.rawToken,
        expiresAt: result.hold.expiresAt.toISOString(),
        expiresInSeconds: HOLD_TTL_MINUTES * 60,
        pricing: {
          nights: result.quote.nights,
          currency: result.quote.currency,
          subtotal: result.quote.subtotal,
          depositAmount: result.quote.depositAmount,
          depositType: result.quote.depositType,
        },
      },
      201
    );
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    if (err.code === 'BOOKING_UNAVAILABLE') {
      const res = errorResponse('CONFLICT', 'No availability for the selected room type and dates', 409);
      Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    console.error('[v1/public/hold POST]', err);
    const res = errorResponse('INTERNAL_ERROR', 'Could not create hold', 500);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}

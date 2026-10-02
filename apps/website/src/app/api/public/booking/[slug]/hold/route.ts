// POST /api/public/booking/[slug]/hold
// Places a 12-minute inventory hold for a room type.
// Must be called before /reservations. Returns an opaque hold token.

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

const HOLD_TTL_MINUTES = 12;

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

  const { roomTypeId, ratePlanId, checkIn: checkInStr, checkOut: checkOutStr } = body;
  if (!roomTypeId || !ratePlanId || !checkInStr || !checkOutStr) {
    return errorResponse('BAD_REQUEST', 'roomTypeId, ratePlanId, checkIn, checkOut are required', 400);
  }

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return errorResponse('BAD_REQUEST', 'Invalid or illogical dates', 400);
  }

  // Validate rate plan access
  if (
    ctx.config.allowedRatePlanIds.length > 0 &&
    !ctx.config.allowedRatePlanIds.includes(ratePlanId)
  ) {
    return errorResponse('NOT_FOUND', 'Rate plan not available for online booking', 404);
  }

  // CRITICAL: Availability check + hold creation must be inside a single
  // serializable transaction to prevent concurrent overbooking.
  // The DB exclusion constraint only covers roomId (physical rooms);
  // room-type overbooking is prevented here at the application layer.
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Assert availability (throws BOOKING_UNAVAILABLE if sold out)
        await AuthoritativeAvailabilityService.assertAvailable(tx as any, {
          propertyId: ctx.property.id,
          roomTypeId,
          checkIn,
          checkOut,
        });

        // 2. Price the hold (immutable snapshot)
        const quote = await ReservationPricingService.quote(tx as any, {
          propertyId: ctx.property.id,
          ratePlanId,
          roomTypeId,
          checkIn,
          checkOut,
          paymentMode: ctx.config.paymentMode,
        });

        // 3. Generate opaque hold token — raw token goes to guest, hash stored in DB
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000);

        // 4. Create the hold
        const hold = await (tx as any).bookingHold.create({
          data: {
            organizationId: ctx.property.organizationId,
            propertyId: ctx.property.id,
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
      // REPEATABLE READ is sufficient to prevent double-counting of holds/reservations
      { isolationLevel: 'RepeatableRead' }
    );

    const res = successResponse(
      {
        holdToken: result.rawToken, // Opaque — guest stores this client-side
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
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (err: any) {
    if (err.code === 'BOOKING_UNAVAILABLE') {
      const res = errorResponse('CONFLICT', 'No availability for the selected room type and dates', 409);
      Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    console.error('[Booking Hold POST]', err);
    const res = errorResponse('INTERNAL_ERROR', 'Could not create hold', 500);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}



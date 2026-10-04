// GET /api/public/booking/[slug]/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&ratePlanId=...
// Returns available room types and a pricing quote for each.

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
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

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function GET(
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

  const url = new URL(req.url);
  const checkInStr = url.searchParams.get('checkIn');
  const checkOutStr = url.searchParams.get('checkOut');
  const requestedRatePlanId = url.searchParams.get('ratePlanId');

  if (!checkInStr || !checkOutStr) {
    return errorResponse('BAD_REQUEST', 'checkIn and checkOut are required', 400);
  }

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return errorResponse('BAD_REQUEST', 'Invalid date format. Use YYYY-MM-DD', 400);
  }
  if (checkOut <= checkIn) {
    return errorResponse('BAD_REQUEST', 'checkOut must be after checkIn', 400);
  }

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights < ctx.config.minStay) {
    return errorResponse('BAD_REQUEST', `Minimum stay is ${ctx.config.minStay} night(s)`, 400);
  }
  if (ctx.config.maxStay && nights > ctx.config.maxStay) {
    return errorResponse('BAD_REQUEST', `Maximum stay is ${ctx.config.maxStay} night(s)`, 400);
  }

  // Validate lead time
  if (ctx.config.bookingLeadTimeHours > 0) {
    const earliestCheckIn = new Date(Date.now() + ctx.config.bookingLeadTimeHours * 3_600_000);
    if (checkIn < earliestCheckIn) {
      return errorResponse(
        'BAD_REQUEST',
        `Bookings must be made at least ${ctx.config.bookingLeadTimeHours} hour(s) in advance`,
        400
      );
    }
  }

  // Validate advance booking window
  if (ctx.config.maxAdvanceDays) {
    const latestCheckIn = new Date(Date.now() + ctx.config.maxAdvanceDays * 86_400_000);
    if (checkIn > latestCheckIn) {
      return errorResponse(
        'BAD_REQUEST',
        `Bookings cannot be made more than ${ctx.config.maxAdvanceDays} days in advance`,
        400
      );
    }
  }

  // Validate rate plan is accessible for this property
  const ratePlanWhere: any = {
    propertyId: ctx.property.id,
    isActive: true,
    isPublic: true,
    deletedAt: null,
  };
  if (requestedRatePlanId) {
    ratePlanWhere.id = requestedRatePlanId;
  }
  if (ctx.config.allowedRatePlanIds.length > 0) {
    ratePlanWhere.id = requestedRatePlanId
      ? (ctx.config.allowedRatePlanIds.includes(requestedRatePlanId) ? requestedRatePlanId : '__not_allowed__')
      : { in: ctx.config.allowedRatePlanIds };
  }

  const ratePlans = await prisma.ratePlan.findMany({ where: ratePlanWhere, orderBy: { name: 'asc' } });
  if (!ratePlans.length) {
    return errorResponse('NOT_FOUND', 'Rate plan not found or not available for online booking', 404);
  }

  // Load all active room types for this property
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: ctx.property.id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      maxOccupancy: true,
      baseRate: true,
      currency: true,
      photos: true,
      amenities: true,
    },
  });

  // Check availability once and price every exposed rate plan. The client may
  // optionally filter with ratePlanId, but does not need to know one up front.
  const results = await Promise.allSettled(
    roomTypes.map(async (rt) => {
      const avail = await AuthoritativeAvailabilityService.check(prisma as any, {
        propertyId: ctx.property.id,
        roomTypeId: rt.id,
        checkIn,
        checkOut,
      });
      const rates = (await Promise.all(ratePlans.map(async (ratePlan) => {
        const quote = await ReservationPricingService.quote(prisma as any, {
          propertyId: ctx.property.id,
          ratePlanId: ratePlan.id,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          paymentMode: ctx.config.paymentMode,
        }).catch(() => null);
        return quote ? {
          ratePlanId: ratePlan.id,
          ratePlanName: ratePlan.name,
          nights: quote.nights,
          currency: quote.currency,
          subtotal: quote.subtotal,
          depositAmount: quote.depositAmount,
          depositType: quote.depositType,
          avgNightlyRate: Math.round((quote.subtotal / quote.nights) * 100) / 100,
        } : null;
      }))).filter(Boolean);

      return {
        roomTypeId: rt.id,
        name: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        photos: rt.photos ?? [],
        amenities: rt.amenities,
        availability: { available: avail.availableRooms, isAvailable: avail.isAvailable },
        rates,
      };
      /*
      const [avail, quote] = await Promise.all([
        AuthoritativeAvailabilityService.check(prisma as any, {
          propertyId: ctx.property.id,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
        }),
        ReservationPricingService.quote(prisma as any, {
          propertyId: ctx.property.id,
          ratePlanId,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          paymentMode: ctx.config.paymentMode,
        }).catch(() => null), // Some room types may have no rates configured
      ]);

      return {
        roomTypeId: rt.id,
        name: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        photos: rt.photos ?? [],
        amenities: rt.amenities,
        availability: {
          available: avail.availableRooms,
          isAvailable: avail.isAvailable,
        },
        pricing: quote
          ? {
              nights: quote.nights,
              currency: quote.currency,
              subtotal: quote.subtotal,
              depositAmount: quote.depositAmount,
              depositType: quote.depositType,
              avgNightlyRate: Math.round((quote.subtotal / quote.nights) * 100) / 100,
            }
          : null,
      };
      */
    })
  );

  const roomTypeResults = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);

  const res = successResponse({ roomTypes: roomTypeResults, checkIn: checkInStr, checkOut: checkOutStr, nights }, 200);
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
  // Short cache — availability changes frequently
  res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=10');
  return res;
}


import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
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
import { AvailabilityQuerySchema } from '@hotel-pms/types';

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await checkRateLimit(ip, 'availability'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  // We load the existing BookingEngineConfig for the property to respect business rules
  const config = await prisma.bookingEngineConfig.findUnique({
    where: { propertyId: ctx.propertyId },
  });

  if (!config || !config.enabled) {
    return errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
  }

  const url = new URL(req.url);
  const parsedQuery = AvailabilityQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsedQuery.success) return errorResponse('BAD_REQUEST', 'Invalid availability query', 400, parsedQuery.error.flatten());
  const { checkIn: checkInStr, checkOut: checkOutStr, ratePlanId: requestedRatePlanId, adults, children } = parsedQuery.data;

  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return errorResponse('BAD_REQUEST', 'Invalid date format. Use YYYY-MM-DD', 400);
  }
  if (checkOut <= checkIn) {
    return errorResponse('BAD_REQUEST', 'checkOut must be after checkIn', 400);
  }

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights < config.minStay) {
    return errorResponse('BAD_REQUEST', `Minimum stay is ${config.minStay} night(s)`, 400);
  }
  if (config.maxStay && nights > config.maxStay) {
    return errorResponse('BAD_REQUEST', `Maximum stay is ${config.maxStay} night(s)`, 400);
  }

  // Validate lead time
  if (config.bookingLeadTimeHours > 0) {
    const earliestCheckIn = new Date(Date.now() + config.bookingLeadTimeHours * 3_600_000);
    if (checkIn < earliestCheckIn) {
      return errorResponse(
        'BAD_REQUEST',
        `Bookings must be made at least ${config.bookingLeadTimeHours} hour(s) in advance`,
        400
      );
    }
  }

  // Validate advance booking window
  if (config.maxAdvanceDays) {
    const latestCheckIn = new Date(Date.now() + config.maxAdvanceDays * 86_400_000);
    if (checkIn > latestCheckIn) {
      return errorResponse(
        'BAD_REQUEST',
        `Bookings cannot be made more than ${config.maxAdvanceDays} days in advance`,
        400
      );
    }
  }

  const ratePlanWhere: any = {
    propertyId: ctx.propertyId,
    isActive: true,
    isPublic: true,
    deletedAt: null,
  };
  if (requestedRatePlanId) {
    ratePlanWhere.id = requestedRatePlanId;
  }
  if (config.allowedRatePlanIds.length > 0) {
    ratePlanWhere.id = requestedRatePlanId
      ? (config.allowedRatePlanIds.includes(requestedRatePlanId) ? requestedRatePlanId : '__not_allowed__')
      : { in: config.allowedRatePlanIds };
  }

  const ratePlans = await prisma.ratePlan.findMany({ where: ratePlanWhere, orderBy: { name: 'asc' } });
  if (!ratePlans.length) {
    return errorResponse('NOT_FOUND', 'Rate plan not found or not available for online booking', 404);
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: ctx.propertyId, isActive: true, deletedAt: null, maxOccupancy: { gte: adults + children } },
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

  const results = await Promise.allSettled(
    roomTypes.map(async (rt) => {
      const avail = await AuthoritativeAvailabilityService.check(prisma as any, {
        propertyId: ctx.propertyId,
        roomTypeId: rt.id,
        checkIn,
        checkOut,
      });
      const rates = (await Promise.all(ratePlans.map(async (ratePlan) => {
        const quote = await ReservationPricingService.quote(prisma as any, {
          propertyId: ctx.propertyId,
          ratePlanId: ratePlan.id,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          paymentMode: config.paymentMode,
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
    })
  );

  const roomTypeResults = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);

  const res = successResponse({ data: roomTypeResults, checkIn: checkInStr, checkOut: checkOutStr, nights, occupancy: { adults, children } }, 200);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
  res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=10');
  return res;
}

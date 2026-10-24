import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { AuthoritativeAvailabilityService } from '@/lib/booking-engine/availability-service';
import { validateBookingPolicy } from '@/lib/booking-engine/booking-policy-service';
import { previewCorporateQuoteSnapshot } from '@/lib/booking-engine/corporate-quote-service';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const querySchema = z.object({ propertyId: z.string().uuid(), checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), adults: z.coerce.number().int().min(1).max(20), children: z.coerce.number().int().min(0).max(20), roomCount: z.coerce.number().int().min(1).max(20).default(1), paymentMode: z.enum(['PAY_LATER', 'FULL', 'DEPOSIT', 'PREPAID']).default('PAY_LATER') });

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'availability:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'availability'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid availability query', 400, parsed.error.flatten()), auth.requestId);
    const { propertyId, checkIn: checkInText, checkOut: checkOutText, adults, children, roomCount, paymentMode } = parsed.data;
    const checkIn = new Date(`${checkInText}T00:00:00.000Z`); const checkOut = new Date(`${checkOutText}T00:00:00.000Z`);
    const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId }, select: { minStay: true, maxStay: true, bookingLeadTimeHours: true, maxAdvanceDays: true } });
    if (config) validateBookingPolicy({ checkIn, checkOut }, config);
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'availability:read');
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId, isActive: true, deletedAt: null, maxOccupancy: { gte: adults + children } }, select: { id: true, name: true, description: true, maxOccupancy: true, photos: true, amenities: true } });
    const results = await Promise.all(roomTypes.map(async (roomType: any) => {
      const availability = await AuthoritativeAvailabilityService.check(prisma as any, { propertyId, roomTypeId: roomType.id, checkIn, checkOut });
      const snapshot = await previewCorporateQuoteSnapshot(prisma as any, principal, { propertyId, roomTypeId: roomType.id, checkIn, checkOut, adults, children, roomCount, paymentMode }).catch(() => null);
      return { ...roomType, photos: roomType.photos ?? [], availability: { available: availability.availableRooms, isAvailable: availability.isAvailable }, rate: snapshot ? { nights: snapshot.pricing.nights, currency: snapshot.totals.currency, subtotal: snapshot.totals.total, avgNightlyRate: Math.round(snapshot.totals.total / snapshot.pricing.nights * 100) / 100, rateDecision: snapshot.rateDecision } : null };
    }));
    return withRequestId(successResponse({ propertyId, checkIn: checkInText, checkOut: checkOutText, occupancy: { adults, children }, rooms: results }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

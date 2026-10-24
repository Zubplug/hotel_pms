import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AuthoritativeAvailabilityService } from '@/lib/booking-engine/availability-service';
import { validateBookingPolicy } from '@/lib/booking-engine/booking-policy-service';
import { previewCorporateQuoteSnapshot } from '@/lib/booking-engine/corporate-quote-service';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import prisma from '@hotel-pms/db';

const querySchema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), adults: z.coerce.number().int().min(1).max(20), children: z.coerce.number().int().min(0).max(20), roomCount: z.coerce.number().int().min(1).max(20).default(1) });

export async function GET(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req); if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-availability'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate availability query', 400, parsed.error.flatten());
  try {
    const body = parsed.data; const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: body.applicationId, token: body.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const checkIn = new Date(`${body.checkIn}T00:00:00.000Z`); const checkOut = new Date(`${body.checkOut}T00:00:00.000Z`);
    const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId: ctx.propertyId }, select: { minStay: true, maxStay: true, bookingLeadTimeHours: true, maxAdvanceDays: true } }); if (config) validateBookingPolicy({ checkIn, checkOut }, config);
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId: ctx.propertyId, isActive: true, deletedAt: null, maxOccupancy: { gte: body.adults + body.children } }, select: { id: true, name: true, description: true, maxOccupancy: true, photos: true, amenities: true } });
    const rooms = await Promise.all(roomTypes.map(async (roomType: any) => { const availability = await AuthoritativeAvailabilityService.check(prisma as any, { propertyId: ctx.propertyId, roomTypeId: roomType.id, checkIn, checkOut }); const snapshot = await previewCorporateQuoteSnapshot(prisma as any, principal, { propertyId: ctx.propertyId, roomTypeId: roomType.id, checkIn, checkOut, adults: body.adults, children: body.children, roomCount: body.roomCount, paymentMode: application.paymentMode }).catch(() => null); return { ...roomType, photos: roomType.photos ?? [], availability: { available: availability.availableRooms, isAvailable: availability.isAvailable }, rate: snapshot ? { nights: snapshot.pricing.nights, currency: snapshot.totals.currency, subtotal: snapshot.totals.total, avgNightlyRate: Math.round(snapshot.totals.total / snapshot.pricing.nights * 100) / 100, rateDecision: snapshot.rateDecision } : null }; }));
    const response = successResponse({ propertyId: ctx.propertyId, checkIn: body.checkIn, checkOut: body.checkOut, occupancy: { adults: body.adults, children: body.children }, rooms }); Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value)); return response;
  } catch (error: any) { return errorResponse(error?.code || 'CONFLICT', error?.message || 'Corporate availability unavailable', 409); }
}

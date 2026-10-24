import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkRateLimit, corsHeaders, isErrorResponse, rateLimitIdentity, resolvePublicApiContext } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';

const schema = z.object({
  applicationId: z.string().uuid(),
  applicationToken: z.string().min(20).max(200),
  reference: z.string().trim().max(80).optional(),
  requestedTerms: z.record(z.string(), z.unknown()),
  proposedRates: z.array(z.object({
    roomTypeId: z.string().uuid(), amount: z.number().positive(), currency: z.string().regex(/^[A-Za-z]{3}$/),
    minStay: z.number().int().min(1).optional(), maxStay: z.number().int().min(1).nullable().optional(),
    minRooms: z.number().int().min(1).optional(), maxRooms: z.number().int().min(1).nullable().optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-rate-negotiation'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid rate negotiation request', 400, parsed.error.flatten());
    const body = parsed.data;
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: body.applicationId, token: body.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const property = await prisma.property.findFirst({ where: { id: ctx.propertyId, organizationId: ctx.organizationId }, select: { baseCurrency: true, supportedCurrencies: true } });
    const supported = new Set([property?.baseCurrency, ...(property?.supportedCurrencies || [])].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase()));
    if (body.proposedRates.some((rate) => !supported.has(rate.currency.toUpperCase()))) return errorResponse('BAD_REQUEST', 'A proposed rate uses an unsupported property currency', 400);
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId: ctx.propertyId, isActive: true, deletedAt: null, id: { in: body.proposedRates.map((rate) => rate.roomTypeId) } }, select: { id: true } });
    if (roomTypes.length !== new Set(body.proposedRates.map((rate) => rate.roomTypeId)).size) return errorResponse('BAD_REQUEST', 'Every proposed rate must reference an active room type in this property', 400);
    const request = await prisma.corporateRateNegotiationRequest.create({ data: { organizationId: ctx.organizationId, propertyId: ctx.propertyId, corporateBookingApplicationId: application.id, requestedByType: 'CORPORATE', requestedById: application.principalId || `PUBLIC_CORPORATE:${application.id}`, reference: body.reference, requestedTerms: body.requestedTerms as any, proposedRates: body.proposedRates, status: 'SUBMITTED' }, select: { id: true, status: true, createdAt: true } });
    const response = successResponse(request, 201);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) {
    return errorResponse(error?.code === 'CORPORATE_APPLICATION_UNAVAILABLE' ? 'UNAUTHORIZED' : 'CONFLICT', error?.message || 'Unable to submit rate negotiation request', 409);
  }
}

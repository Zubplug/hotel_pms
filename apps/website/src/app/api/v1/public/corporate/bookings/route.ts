import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import { createCorporateReservation } from '@/lib/booking-engine/corporate-booking-service';

const guest = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().email().max(320), phone: z.string().max(50).optional(), country: z.string().max(2).optional() });
const schema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), quoteId: z.string().uuid(), guests: z.array(guest).min(1).max(20).optional(), deferGuestDetails: z.boolean().optional(), specialRequests: z.string().max(2000).optional(), externalReference: z.string().max(128).optional() }).refine((value) => Boolean(value.guests?.length) || value.deferGuestDetails === true, { message: 'Provide guests or defer guest details to the corporate portal or Front Desk' });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-booking'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400);
  }
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate booking', 400, parsed.error.flatten());
    const body = parsed.data;
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: body.applicationId, token: body.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const result = await createCorporateReservation(prisma as any, principal, { quoteId: body.quoteId, guests: body.guests, specialRequests: body.specialRequests, externalReference: body.externalReference, idempotencyKey });
    const response = successResponse(result, result.idempotent ? 200 : 201);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) { return errorResponse(error?.code || 'CONFLICT', error?.message || 'Corporate booking unavailable', 409); }
}

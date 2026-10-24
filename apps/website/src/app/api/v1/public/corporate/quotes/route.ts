import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import { createCorporateQuote } from '@/lib/booking-engine/corporate-quote-service';

const schema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), roomTypeId: z.string().uuid().optional(), roomSelections: z.array(z.object({ roomTypeId: z.string().uuid(), roomCount: z.number().int().min(1), checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).min(1).optional(), checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(20), roomCount: z.number().int().min(1).default(1), paymentMode: z.string().optional(), ttlSeconds: z.number().int().optional() }).refine((value) => Boolean(value.roomSelections?.length) || Boolean(value.roomTypeId), { message: 'Select at least one room type' });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-quote'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate quote', 400, parsed.error.flatten());
    const body = parsed.data;
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: body.applicationId, token: body.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const quote = await createCorporateQuote(prisma as any, principal, { ...body, roomTypeId: body.roomTypeId || body.roomSelections![0].roomTypeId, propertyId: ctx.propertyId, checkIn: new Date(`${body.checkIn}T00:00:00.000Z`), checkOut: new Date(`${body.checkOut}T00:00:00.000Z`) });
    const response = successResponse({ quoteId: quote.id, expiresAt: quote.expiresAt, snapshot: quote.snapshot }, 201);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) { return errorResponse(error?.code || 'CONFLICT', error?.message || 'Corporate quote unavailable', 409); }
}

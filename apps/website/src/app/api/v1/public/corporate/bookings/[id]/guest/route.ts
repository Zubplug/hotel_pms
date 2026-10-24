import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import { updateCorporateReservationGuest } from '@/lib/booking-engine/corporate-guest-service';

const schema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), guest: z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().email().max(320), phone: z.string().trim().max(50).optional(), country: z.string().trim().length(2).optional() }) });

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-booking-guest-update'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid guest details', 400, parsed.error.flatten());
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: parsed.data.applicationId, token: parsed.data.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, partnerId: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const result = await updateCorporateReservationGuest(prisma as any, principal, (await context.params).id, parsed.data.guest, `PUBLIC_CORPORATE:${(await context.params).id}`);
    const response = successResponse(result);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) {
    const status = error?.code === 'NOT_FOUND' ? 404 : error?.code === 'GUEST_EDIT_LOCKED' ? 409 : 401;
    return errorResponse(error?.code || 'CONFLICT', error?.message || 'Guest details could not be updated', status);
  }
}

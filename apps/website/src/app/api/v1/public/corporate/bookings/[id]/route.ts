import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corsHeaders, resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import { cancelCorporateReservation, corporateCancellationPreview, findCorporateReservation } from '@/lib/booking-engine/corporate-cancellation-service';

const bodySchema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), reason: z.string().max(500).optional(), preview: z.boolean().optional() });

function withCors(response: Response, req: NextRequest, allowedOrigins: string[]) {
  Object.entries(corsHeaders(req, allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-booking-read'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const params = req.nextUrl.searchParams;
  const applicationId = params.get('applicationId');
  const applicationToken = params.get('applicationToken');
  if (!applicationId || !applicationToken) return errorResponse('BAD_REQUEST', 'Application credentials are required', 400);
  try {
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId, token: applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, partnerId: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const reservation = await findCorporateReservation(prisma as any, principal, (await context.params).id);
    return withCors(successResponse({ id: reservation.id, confirmationNumber: reservation.confirmationNumber, status: reservation.status, propertyId: reservation.propertyId, checkIn: reservation.checkIn, checkOut: reservation.checkOut, guest: reservation.primaryGuest, total: (reservation.ratePlanSnapshot as any)?.total, currency: reservation.currency }), req, ctx.allowedOrigins);
  } catch (error: any) {
    return withCors(errorResponse(error?.code === 'CORPORATE_APPLICATION_UNAVAILABLE' ? 'UNAUTHORIZED' : 'NOT_FOUND', error?.message || 'Corporate reservation not found', 404), req, ctx.allowedOrigins);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-booking-cancel'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid cancellation payload', 400, parsed.error.flatten());
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: parsed.data.applicationId, token: parsed.data.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const principal = { id: application.principalId || `PUBLIC_CORPORATE:${application.id}`, partnerId: application.principalId || `PUBLIC_CORPORATE:${application.id}`, organizationId: ctx.organizationId, propertyIds: [ctx.propertyId], corporateApplicationId: application.id };
    const reservationId = (await context.params).id;
    const reservation = await findCorporateReservation(prisma as any, principal, reservationId);
    const result = parsed.data.preview ? { reservationId, ...corporateCancellationPreview(reservation) } : await cancelCorporateReservation(prisma as any, principal, reservationId, parsed.data.reason);
    return withCors(successResponse(result), req, ctx.allowedOrigins);
  } catch (error: any) {
    const status = error?.code === 'NOT_FOUND' ? 404 : error?.code === 'NOT_CANCELLABLE' || error?.code === 'ALREADY_CANCELLED' ? 409 : 401;
    return withCors(errorResponse(error?.code || 'CONFLICT', error?.message || 'Corporate cancellation unavailable', status), req, ctx.allowedOrigins);
  }
}

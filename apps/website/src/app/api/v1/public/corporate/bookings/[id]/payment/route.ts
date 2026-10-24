import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkRateLimit, corsHeaders, isErrorResponse, rateLimitIdentity, resolvePublicApiContext } from '@/lib/booking-engine/middleware';
import { resolvePublicCorporateApplication } from '@/lib/booking-engine/corporate-public-auth';
import { initializeCorporateGatewayPayment, CorporatePaymentInitializationError } from '@/lib/booking-engine/corporate-payment-service';

const bodySchema = z.object({ applicationId: z.string().uuid(), applicationToken: z.string().min(20).max(200), email: z.string().email().optional(), amount: z.number().positive().optional() });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-payment'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400);
  try {
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return errorResponse('BAD_REQUEST', 'Invalid payment payload', 400, body.error.flatten());
    const application = await resolvePublicCorporateApplication(prisma as any, { applicationId: body.data.applicationId, token: body.data.applicationToken, organizationId: ctx.organizationId, propertyId: ctx.propertyId });
    const reservation = await prisma.reservation.findFirst({ where: { id: (await context.params).id, propertyId: ctx.propertyId, corporateBookingApplicationId: application.id, source: 'CORPORATE', status: 'PENDING', property: { organizationId: ctx.organizationId } }, include: { primaryGuest: { select: { email: true } } } });
    if (!reservation) return errorResponse('NOT_FOUND', 'Corporate reservation not found', 404);
    if (reservation.paymentExpiresAt && reservation.paymentExpiresAt <= new Date()) return errorResponse('GONE', 'The reservation payment window has expired', 410);
    const result = await initializeCorporateGatewayPayment(prisma as any, { organizationId: ctx.organizationId, reservation, idempotencyKey, email: body.data.email, amount: body.data.amount });
    const response = successResponse(result);
    Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error: any) {
    if (error instanceof CorporatePaymentInitializationError) {
      const status = error.code === 'NO_PAYMENT_ACCOUNT' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : error.code === 'INVALID_AMOUNT' ? 400 : 409;
      return errorResponse(error.code, error.message, status);
    }
    return errorResponse(error?.code === 'CORPORATE_APPLICATION_UNAVAILABLE' ? 'UNAUTHORIZED' : 'CONFLICT', error?.message || 'Corporate payment unavailable', 409);
  }
}

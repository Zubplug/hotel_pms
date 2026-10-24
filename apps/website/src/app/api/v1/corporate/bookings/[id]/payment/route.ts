import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';
import { findCorporateReservation } from '@/lib/booking-engine/corporate-cancellation-service';
import { initializeCorporateGatewayPayment, CorporatePaymentInitializationError } from '@/lib/booking-engine/corporate-payment-service';

const bodySchema = z.object({ email: z.string().email().optional(), amount: z.number().positive().optional() });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'invoices:pay');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'payments'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const reservation = await findCorporateReservation(prisma as any, auth.principal, (await context.params).id);
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid payment payload', 400, body.error.flatten()), auth.requestId);
    if (reservation.status !== 'PENDING') return withRequestId(errorResponse('CONFLICT', 'Reservation is not awaiting payment', 409), auth.requestId);
    if (reservation.paymentExpiresAt && reservation.paymentExpiresAt <= new Date()) return withRequestId(errorResponse('GONE', 'The reservation payment window has expired', 410), auth.requestId);
    const result = await initializeCorporateGatewayPayment(prisma as any, { organizationId: auth.principal.organizationId, reservation, idempotencyKey, email: body.data.email, amount: body.data.amount });
    return withRequestId(successResponse(result), auth.requestId);
  } catch (error) {
    if (error instanceof CorporatePaymentInitializationError) {
      const status = error.code === 'NO_PAYMENT_ACCOUNT' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : error.code === 'INVALID_AMOUNT' ? 400 : 409;
      return withRequestId(errorResponse(error.code, error.message, status), auth.requestId);
    }
    return corporateError(error, auth.requestId);
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';
import { CorporatePaymentInitializationError, initializeCorporateAdvanceGatewayPayment } from '@/lib/booking-engine/corporate-payment-service';

const bodySchema = z.object({ propertyId: z.string().uuid().optional(), email: z.string().email(), amount: z.number().positive() });

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'invoices:pay');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'wallet-credit'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const parsed = bodySchema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid corporate wallet credit payload', 400, parsed.error.flatten()), auth.requestId);
    const propertyId = parsed.data.propertyId || req.nextUrl.searchParams.get('propertyId');
    if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'Property ID is required', 400), auth.requestId);
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'invoices:pay');
    if (!principal.corporateAccountId) return withRequestId(errorResponse('CORPORATE_ACCOUNT_UNAVAILABLE', 'No active corporate account is mapped to this property', 409), auth.requestId);
    const result = await initializeCorporateAdvanceGatewayPayment(prisma as any, { organizationId: auth.principal.organizationId, propertyId, corporateAccountId: principal.corporateAccountId, idempotencyKey, email: parsed.data.email, amount: parsed.data.amount });
    return withRequestId(successResponse(result), auth.requestId);
  } catch (error) {
    if (error instanceof CorporatePaymentInitializationError) {
      const status = error.code === 'NO_PAYMENT_ACCOUNT' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : error.code === 'INVALID_AMOUNT' ? 400 : 409;
      return withRequestId(errorResponse(error.code, error.message, status), auth.requestId);
    }
    return corporateError(error, auth.requestId);
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { initializeCorporateInvoiceGatewayPayment, CorporatePaymentInitializationError } from '@/lib/booking-engine/corporate-payment-service';
import { corporateError, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const bodySchema = z.object({ propertyId: z.string().uuid(), email: z.string().email(), amount: z.number().positive().optional() });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'invoices:pay');
  if (auth instanceof Response) return auth;
  if (auth.principal.partnerId.startsWith('portal:')) return withRequestId(errorResponse('WALLET_ONLY', 'Corporate portal payments must credit the City Ledger wallet; individual invoice payment is not available.', 409), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'invoice-payments'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const parsed = bodySchema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid invoice payment payload', 400, parsed.error.flatten()), auth.requestId);
    const principal = await corporatePrincipalForProperty(auth.principal, parsed.data.propertyId, 'invoices:pay');
    const invoice = await prisma.cityLedgerInvoice.findFirst({ where: { id: (await context.params).id, propertyId: parsed.data.propertyId, account: { CorporateAccount: { some: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId: parsed.data.propertyId, isActive: true } } } } });
    if (!invoice || !principal.corporateAccountId) return withRequestId(errorResponse('NOT_FOUND', 'Corporate invoice not found', 404), auth.requestId);
    const result = await initializeCorporateInvoiceGatewayPayment(prisma as any, { organizationId: auth.principal.organizationId, propertyId: parsed.data.propertyId, corporateAccountId: principal.corporateAccountId, invoice, idempotencyKey, email: parsed.data.email, amount: parsed.data.amount });
    return withRequestId(successResponse(result), auth.requestId);
  } catch (error) {
    if (error instanceof CorporatePaymentInitializationError) {
      const status = error.code === 'NO_PAYMENT_ACCOUNT' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : error.code === 'INVALID_AMOUNT' ? 400 : 409;
      return withRequestId(errorResponse(error.code, error.message, status), auth.requestId);
    }
    return corporateError(error, auth.requestId);
  }
}

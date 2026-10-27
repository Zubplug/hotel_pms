import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { CorporatePaymentInitializationError, initializeCorporateInvoiceGatewayPayment } from '@/lib/booking-engine/corporate-payment-service';
import { corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const schema = z.object({ propertyId: z.string().uuid(), email: z.string().email(), amount: z.number().positive().optional() });
export async function POST(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const auth = await requireCorporateApi(req, 'invoices:pay');
  if (auth instanceof Response) return auth;
  const key = req.headers.get('x-idempotency-key')?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const parsed = schema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid event payment payload', 400), auth.requestId);
    const principal = await corporatePrincipalForProperty(auth.principal, parsed.data.propertyId, 'invoices:pay');
    if (!principal.corporateAccountId) return withRequestId(errorResponse('NOT_FOUND', 'Corporate account not found', 404), auth.requestId);
    const event = await prisma.event.findFirst({ where: { id: (await context.params).eventId, propertyId: parsed.data.propertyId, corporateAccountId: principal.corporateAccountId }, include: { invoices: { include: { cityLedgerInvoice: true } } } });
    const invoice = event?.invoices[0]?.cityLedgerInvoice;
    if (!invoice) return withRequestId(errorResponse('NOT_FOUND', 'Payable event invoice not found', 404), auth.requestId);
    const result = await initializeCorporateInvoiceGatewayPayment(prisma as any, { organizationId: auth.principal.organizationId, propertyId: parsed.data.propertyId, corporateAccountId: principal.corporateAccountId, invoice, idempotencyKey: key, email: parsed.data.email, amount: parsed.data.amount, eventId: event.id });
    return withRequestId(successResponse({ ...result, eventId: event.id }), auth.requestId);
  } catch (error) {
    if (error instanceof CorporatePaymentInitializationError) return withRequestId(errorResponse(error.code, error.message, error.code === 'NO_PAYMENT_ACCOUNT' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : error.code === 'INVALID_AMOUNT' ? 400 : 409), auth.requestId);
    return withRequestId(errorResponse('INTERNAL_ERROR', 'Unable to initialize event payment', 500), auth.requestId);
  }
}

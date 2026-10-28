import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corporateError, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';
import { createCorporateEventBooking } from '@/lib/booking-engine/corporate-event-service';

const schema = z.object({
  propertyId: z.string().uuid(), quoteId: z.string().uuid(), contactName: z.string().trim().min(2).max(160),
  contactEmail: z.string().email(), contactPhone: z.string().trim().max(50).optional(), paymentMode: z.enum(['PAY_LATER', 'DEPOSIT', 'FULL']).default('PAY_LATER'),
});

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'bookings:create');
  if (auth instanceof Response) return auth;
  const key = req.headers.get('x-idempotency-key')?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const parsed = schema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid corporate event booking payload', 400, parsed.error.flatten()), auth.requestId);
    const principal = await corporatePrincipalForProperty(auth.principal, parsed.data.propertyId, 'bookings:create');
    if (!principal.corporateAccountId) return withRequestId(errorResponse('CORPORATE_ACCOUNT_UNAVAILABLE', 'No corporate account is linked to this portal', 409), auth.requestId);
    const result = await createCorporateEventBooking(prisma as any, { ...parsed.data, principalId: auth.principal.partnerId, organizationId: auth.principal.organizationId, corporateAccountId: principal.corporateAccountId, idempotencyKey: key });
    return withRequestId(successResponse(result), auth.requestId);
  } catch (error: any) {
    const map: Record<string, [string, number]> = { IDEMPOTENCY_CONFLICT: ['IDEMPOTENCY_CONFLICT', 409], REQUEST_PROCESSING: ['REQUEST_PROCESSING', 409], HALL_NO_LONGER_AVAILABLE: ['HALL_NO_LONGER_AVAILABLE', 409], HALL_UNAVAILABLE: ['HALL_UNAVAILABLE', 409], CORPORATE_ACCOUNT_UNAVAILABLE: ['CORPORATE_ACCOUNT_UNAVAILABLE', 409], QUOTE_REQUIRED: ['BAD_REQUEST', 400], QUOTE_NOT_FOUND: ['QUOTE_NOT_FOUND', 404], QUOTE_EXPIRED: ['QUOTE_EXPIRED', 409], QUOTE_TAMPERED: ['QUOTE_TAMPERED', 409], QUOTE_PRICE_CHANGED: ['QUOTE_PRICE_CHANGED', 409], INVALID_CONTACT: ['INVALID_CONTACT', 400] };
    if (map[error?.message]) return withRequestId(errorResponse(map[error.message][0], error.message.replaceAll('_', ' ').toLowerCase(), map[error.message][1]), auth.requestId);
    return corporateError(error, auth.requestId);
  }
}

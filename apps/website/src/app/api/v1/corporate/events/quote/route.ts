import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { createCorporateEventQuote } from '@/lib/booking-engine/corporate-event-quote-service';
import { corporateError, corporatePrincipalForProperty, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const schema = z.object({
  propertyId: z.string().uuid(),
  requestType: z.enum(['HALL_ONLY', 'HALL_AND_EVENT']),
  hallId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  expectedGuests: z.number().int().min(1).max(100000),
  eventName: z.string().trim().max(160).optional(),
  paymentMode: z.enum(['PAY_LATER', 'DEPOSIT', 'FULL']).default('PAY_LATER'),
  addOns: z.array(z.object({ equipmentId: z.string().uuid(), quantity: z.number().int().min(0).max(1000) })).max(50).default([]),
});

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'quotes:create');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'event-quote'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = schema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid corporate event quote payload', 400, parsed.error.flatten()), auth.requestId);
    const principal = await corporatePrincipalForProperty(auth.principal, parsed.data.propertyId, 'quotes:create');
    if (!principal.corporateAccountId) return withRequestId(errorResponse('CORPORATE_ACCOUNT_UNAVAILABLE', 'No corporate account is linked to this portal', 409), auth.requestId);
    const quote = await createCorporateEventQuote(prisma as any, { ...parsed.data, organizationId: principal.organizationId, principalId: auth.principal.partnerId, corporateAccountId: principal.corporateAccountId, startAt: new Date(parsed.data.startAt), endAt: new Date(parsed.data.endAt) });
    return withRequestId(successResponse({ quoteId: quote.id, expiresAt: quote.expiresAt, snapshot: quote.snapshot }, 201), auth.requestId);
  } catch (error) {
    const map: Record<string, [string, number]> = { HALL_UNAVAILABLE: ['HALL_UNAVAILABLE', 409], HALL_NO_LONGER_AVAILABLE: ['HALL_NO_LONGER_AVAILABLE', 409], ADDON_UNAVAILABLE: ['ADDON_UNAVAILABLE', 409], INVALID_ADDON_QUANTITY: ['BAD_REQUEST', 400], INVALID_PAYMENT_MODE: ['BAD_REQUEST', 400], INVALID_GUEST_COUNT: ['BAD_REQUEST', 400], INVALID_DATE_RANGE: ['BAD_REQUEST', 400], EVENT_NAME_REQUIRED: ['BAD_REQUEST', 400], CORPORATE_ACCOUNT_UNAVAILABLE: ['CORPORATE_ACCOUNT_UNAVAILABLE', 409] };
    if (map[(error as Error)?.message]) return withRequestId(errorResponse(map[(error as Error).message][0], (error as Error).message.replaceAll('_', ' ').toLowerCase(), map[(error as Error).message][1]), auth.requestId);
    return corporateError(error, auth.requestId);
  }
}

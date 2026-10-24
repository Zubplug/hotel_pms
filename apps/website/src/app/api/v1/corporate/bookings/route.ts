import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { createCorporateReservation } from '@/lib/booking-engine/corporate-booking-service';
import { corporateError, corporatePrincipalForQuote, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const guestSchema = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().email().max(320), phone: z.string().max(50).optional(), country: z.string().max(2).optional() });
const bookingSchema = z.object({
  quoteId: z.string().min(1),
  // `guest` is retained for backwards compatibility. New multi-room clients
  // should send one guest per requested room in `guests`.
  guest: guestSchema.optional(),
  guests: z.array(guestSchema).min(1).max(20).optional(),
  deferGuestDetails: z.boolean().optional(),
  specialRequests: z.string().max(2000).optional(),
  externalReference: z.string().max(128).optional(),
}).refine((value) => (Boolean(value.guest) !== Boolean(value.guests)) || value.deferGuestDetails === true, { message: 'Provide guests or defer guest details to the corporate portal or Front Desk' });

export async function POST(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'bookings:create');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'bookings:create'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  const idempotencyKey = req.headers.get('x-idempotency-key');
  if (!idempotencyKey) return withRequestId(errorResponse('BAD_REQUEST', 'X-Idempotency-Key is required', 400), auth.requestId);
  try {
    const parsed = bookingSchema.safeParse(await jsonBody(req, auth.principal.requestSizeLimitBytes));
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid booking payload', 400, parsed.error.flatten()), auth.requestId);
    const principal = await corporatePrincipalForQuote(auth.principal, parsed.data.quoteId);
    const { guest, guests, ...booking } = parsed.data;
    const result = await createCorporateReservation(prisma as any, principal, { ...booking, guest, guests, idempotencyKey });
    return withRequestId(successResponse(result, result.idempotent ? 200 : 201), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

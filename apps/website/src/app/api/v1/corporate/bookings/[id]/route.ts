import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { findCorporateReservation } from '@/lib/booking-engine/corporate-cancellation-service';
import { corporateError, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';
import { updateCorporateReservationGuest } from '@/lib/booking-engine/corporate-guest-service';
import { z } from 'zod';

const guestSchema = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().email().max(320), phone: z.string().trim().max(50).optional(), country: z.string().trim().length(2).optional() });

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'bookings:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'bookings:read'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const reservation = await findCorporateReservation(prisma as any, auth.principal, (await context.params).id);
    return withRequestId(successResponse({ id: reservation.id, confirmationNumber: reservation.confirmationNumber, status: reservation.status, propertyId: reservation.propertyId, checkIn: reservation.checkIn, checkOut: reservation.checkOut, adults: reservation.adults, children: reservation.children, guest: reservation.primaryGuest, total: reservation.ratePlanSnapshot && (reservation.ratePlanSnapshot as any).total, currency: reservation.currency }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'bookings:create');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'bookings:guest-update'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const parsed = z.object({ guest: guestSchema }).safeParse(await req.json());
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid guest details', 400, parsed.error.flatten()), auth.requestId);
    const result = await updateCorporateReservationGuest(prisma as any, { ...auth.principal, partnerId: auth.principal.partnerId }, (await context.params).id, parsed.data.guest, auth.requestId);
    return withRequestId(successResponse(result), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

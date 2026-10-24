import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { findCorporateReservation } from '@/lib/booking-engine/corporate-cancellation-service';
import { corporateError, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'bookings:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'bookings:read'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const reservation = await findCorporateReservation(prisma as any, auth.principal, (await context.params).id);
    return withRequestId(successResponse({ id: reservation.id, confirmationNumber: reservation.confirmationNumber, status: reservation.status, propertyId: reservation.propertyId, checkIn: reservation.checkIn, checkOut: reservation.checkOut, adults: reservation.adults, children: reservation.children, guest: reservation.primaryGuest, total: reservation.ratePlanSnapshot && (reservation.ratePlanSnapshot as any).total, currency: reservation.currency }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

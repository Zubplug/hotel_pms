import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'bookings:read');
  if (auth instanceof Response) return auth;
  const params = new URL(req.url).searchParams;
  const propertyId = params.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'reservations'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'bookings:read');
    const limit = Math.min(Math.max(Number(params.get('limit') || 50), 1), 100);
    const reservations = await prisma.reservation.findMany({
      where: { corporateAccountId: principal.corporateAccountId, propertyId, source: 'CORPORATE', property: { organizationId: auth.principal.organizationId } },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, confirmationNumber: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, currency: true, ratePlanSnapshot: true, primaryGuest: { select: { firstName: true, lastName: true, email: true } }, reservationRooms: { where: { status: 'ACTIVE' }, select: { roomTypeId: true, roomId: true, adults: true, children: true, rateAmount: true, currency: true } } },
    });
    return withRequestId(successResponse({ reservations }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

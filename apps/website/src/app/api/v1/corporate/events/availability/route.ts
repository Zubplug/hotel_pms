import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const params = new URL(req.url).searchParams;
  const propertyId = params.get('propertyId');
  const startAt = params.get('startAt');
  const endAt = params.get('endAt');
  const guests = Math.max(1, Number(params.get('guests') || 1));
  if (!propertyId || !startAt || !endAt || !Number.isInteger(guests)) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId, startAt, endAt and guests are required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'event-availability'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);

  try {
    await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start < new Date()) return withRequestId(errorResponse('BAD_REQUEST', 'Choose a future date with a valid time range', 400), auth.requestId);

    const halls = await prisma.hall.findMany({
      where: { propertyId, isActive: true, capacity: { gte: guests } },
      orderBy: [{ capacity: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, capacity: true, squareMeters: true, amenities: true, rate: true },
    });
    const bookings = halls.length ? await prisma.eventBooking.findMany({
      where: { hallId: { in: halls.map((hall) => hall.id) }, status: 'ACTIVE', startTime: { lt: end }, endTime: { gt: start }, event: { status: { not: 'CANCELLED' } } },
      select: { hallId: true, startTime: true, endTime: true, setupBufferMinutes: true, teardownBufferMinutes: true },
    }) : [];
    const available = halls.filter((hall) => !bookings.some((booking) => {
      if (booking.hallId !== hall.id) return false;
      const bookingStart = new Date(booking.startTime.getTime() - booking.setupBufferMinutes * 60000);
      const bookingEnd = new Date(booking.endTime.getTime() + booking.teardownBufferMinutes * 60000);
      return bookingStart < end && bookingEnd > start;
    }));

    return withRequestId(successResponse({
      startAt: start.toISOString(), endAt: end.toISOString(), guests,
      halls: available.map((hall) => ({ ...hall, squareMeters: hall.squareMeters == null ? null : Number(hall.squareMeters), rate: hall.rate == null ? null : Number(hall.rate) })),
    }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

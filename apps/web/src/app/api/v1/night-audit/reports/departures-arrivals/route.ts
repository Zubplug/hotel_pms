import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { format, differenceInDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);
    const startOfDay = new Date(businessDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(businessDate);
    endOfDay.setHours(23, 59, 59, 999);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    const arrivals = await prisma.reservation.findMany({
      where: { propertyId, checkIn: { gte: startOfDay, lte: endOfDay } },
      include: { primaryGuest: true, reservationRooms: { include: { room: true } }, folios: true }
    });

    const departures = await prisma.reservation.findMany({
      where: { propertyId, checkOut: { gte: startOfDay, lte: endOfDay } },
      include: { primaryGuest: true, reservationRooms: { include: { room: true } }, folios: true }
    });

    let noShows = 0;
    let earlyArrivals = 0;
    let earlyDepartures = 0;
    let extensions = 0;
    let unconfirmedDepartures = 0;

    const expectedArrivals = arrivals.map(res => {
      if (res.status === 'NO_SHOW') noShows++;
      return {
        reservationId: res.id.slice(-6).toUpperCase(),
        guestName: `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}`,
        roomNumber: res.reservationRooms[0]?.room?.number || 'Unassigned',
        roomType: 'Assigned',
        eta: '14:00',
        nights: Math.max(1, differenceInDays(res.checkOut, res.checkIn)),
        rate: Number(res.reservationRooms[0]?.rateAmount || 0),
        balance: Number(res.folios[0]?.balance || 0),
        status: Number(res.folios[0]?.balance || 0) <= 0 ? 'PAID' : 'UNPAID',
        notes: res.specialRequests || ''
      };
    });

    const expectedDepartures = departures.map(res => {
      if (res.status !== 'CHECKED_OUT') unconfirmedDepartures++;
      return {
        reservationId: res.id.slice(-6).toUpperCase(),
        guestName: `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}`,
        roomNumber: res.reservationRooms[0]?.room?.number || 'Unassigned',
        roomType: 'Assigned',
        departureTime: '11:00',
        rate: Number(res.reservationRooms[0]?.rateAmount || 0),
        balance: Number(res.folios[0]?.balance || 0),
        status: Number(res.folios[0]?.balance || 0) <= 0 ? 'PAID' : 'UNPAID',
        roomStatus: res.status === 'CHECKED_OUT' ? 'DEPARTED' : 'IN_HOUSE'
      };
    });

    const metrics = { noShows, earlyArrivals, earlyDepartures, extensions, unconfirmedDepartures };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      expectedArrivals,
      expectedDepartures,
      metrics
    });

  } catch (err: any) {
    console.error('[Departures Arrivals GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

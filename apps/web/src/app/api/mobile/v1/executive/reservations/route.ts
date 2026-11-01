import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';
const asNumber = (value: unknown) => Number(value ?? 0);

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (user.isSuperAdmin !== true && !['ADMIN', 'MANAGER', 'DIRECTOR', 'EXECUTIVE'].includes(user.role)) return errorResponse('FORBIDDEN', 'Executive or Management access required', 403);
    const ctx = await requireOrganizationContext(user.id);
    const params = new URL(req.url).searchParams;
    const requestedPropertyId = params.get('propertyId');
    const propertyId = !requestedPropertyId ||
      requestedPropertyId === 'AUTO_SELECT_FIRST' ||
      requestedPropertyId === 'ALL_AUTHORIZED'
      ? ctx.propertyIds[0]
      : requestedPropertyId;
    const reservationId = params.get('reservationId');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Access denied to this property', 403);

    if (reservationId) {
      const reservation = await prisma.reservation.findFirst({
        where: { id: reservationId, propertyId, deletedAt: null },
        include: {
          primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVip: true, vipLevel: true, companyName: true } },
          reservationRooms: { include: { room: { select: { id: true, number: true, displayName: true } } }, orderBy: { checkIn: 'asc' } },
          folios: { where: { status: { not: 'VOID' } }, orderBy: { createdAt: 'asc' }, include: { items: { where: { voidedAt: null }, orderBy: { businessDate: 'asc' }, take: 100 } } },
        },
      });
      if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
      return successResponse({ reservation: serializeReservation(reservation, true) }, 200);
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } });
    const date = params.get('date') || property?.businessDate?.toISOString().slice(0, 10);
    if (!date) return errorResponse('BAD_REQUEST', 'Property business date is unavailable', 400);
    const day = new Date(`${date}T00:00:00.000Z`);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const reservations = await prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, OR: [
        { status: 'CHECKED_IN', checkIn: { lt: nextDay }, checkOut: { gt: day } },
        { status: 'NO_SHOW', checkIn: day },
        { status: { in: ['CONFIRMED', 'PENDING'] }, checkIn: day },
      ] },
      orderBy: [{ checkIn: 'asc' }, { primaryGuest: { lastName: 'asc' } }],
      include: {
        primaryGuest: { select: { id: true, firstName: true, lastName: true, isVip: true, vipLevel: true, companyName: true } },
        reservationRooms: { where: { status: { not: 'CANCELLED' } }, include: { room: { select: { number: true } } }, take: 3 },
        folios: { where: { status: { not: 'VOID' } }, select: { balance: true, totalCharges: true, totalPayments: true, currency: true }, take: 10 },
      },
    });
    const items = reservations.map((reservation) => serializeReservation(reservation));
    return successResponse({ date, propertyId, checkedIn: items.filter((item) => item.category === 'CHECKED_IN'), noShows: items.filter((item) => item.category === 'NO_SHOW'), reserved: items.filter((item) => item.category === 'RESERVED') }, 200);
  } catch (error: any) {
    console.error('[Mobile Executive Reservations]', error);
    return errorResponse('INTERNAL_ERROR', error?.message || 'Unable to load reservations', 500);
  }
}

function serializeReservation(reservation: any, detailed = false) {
  const guest = reservation.primaryGuest;
  const folios = reservation.folios || [];
  const category = reservation.status === 'CHECKED_IN' ? 'CHECKED_IN' : reservation.status === 'NO_SHOW' ? 'NO_SHOW' : 'RESERVED';
  return {
    id: reservation.id,
    confirmationNumber: reservation.confirmationNumber,
    category,
    status: reservation.status,
    guest: { id: guest.id, name: `${guest.firstName} ${guest.lastName}`.trim(), email: guest.email || null, phone: guest.phone || null, isVip: guest.isVip, vipLevel: guest.vipLevel || null, companyName: guest.companyName || null },
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    adults: reservation.adults,
    children: reservation.children,
    currency: reservation.currency,
    rooms: (reservation.reservationRooms || []).map((room: any) => ({ id: room.id, number: room.room?.number || 'Unassigned', status: room.status, rateAmount: asNumber(room.rateAmount), checkIn: room.checkIn, checkOut: room.checkOut })),
    folios: detailed ? folios.map((item: any) => ({ id: item.id, folioNumber: item.folioNumber, type: item.type, status: item.status, currency: item.currency, totalCharges: asNumber(item.totalCharges), totalPayments: asNumber(item.totalPayments), balance: asNumber(item.balance), items: (item.items || []).map((line: any) => ({ id: line.id, businessDate: line.businessDate, type: line.type, description: line.description, amount: asNumber(line.amount), currency: line.currency, revenueCategory: line.revenueCategory })) })) : folios.map((item: any) => ({ totalCharges: asNumber(item.totalCharges), totalPayments: asNumber(item.totalPayments), balance: asNumber(item.balance), currency: item.currency })),
  };
}

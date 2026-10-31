import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id;
    if (!userId) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const ctx = await requireOrganizationContext(userId);
    const requestedPropertyId = req.nextUrl.searchParams.get('propertyId');
    const propertyId = requestedPropertyId || ctx.propertyIds[0];
    const query = (req.nextUrl.searchParams.get('search') || '').trim().toLowerCase();
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
    const businessDate = property.businessDate || new Date();
    const previousAuditDate = new Date(businessDate);
    previousAuditDate.setUTCDate(previousAuditDate.getUTCDate() - 1);

    const reservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        reservationRooms: { some: { status: 'ACTIVE', checkIn: { lte: businessDate }, checkOut: { gt: businessDate } } },
        ...(query ? {
          OR: [
            { confirmationNumber: { contains: query, mode: 'insensitive' } },
            { primaryGuest: { firstName: { contains: query, mode: 'insensitive' } } },
            { primaryGuest: { lastName: { contains: query, mode: 'insensitive' } } },
            { reservationRooms: { some: { room: { number: { contains: query, mode: 'insensitive' } } } } },
          ],
        } : {}),
      },
      orderBy: { primaryGuest: { lastName: 'asc' } },
      select: {
        id: true,
        primaryGuestId: true,
        checkIn: true,
        checkOut: true,
        confirmationNumber: true,
        adults: true,
        primaryGuest: { select: { firstName: true, lastName: true, isVip: true } },
        reservationRooms: { where: { status: 'ACTIVE' }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: { room: { select: { number: true } } } },
        folios: { where: { status: 'OPEN', type: { in: ['MAIN', 'ROOM', 'CITY_LEDGER'] } }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, balance: true, currency: true } },
      },
    });

    const reservationIds = reservations.map((reservation) => reservation.id);
    const priorFoodAllocations = reservationIds.length
      ? await prisma.folioItem.findMany({
          where: {
            reservationId: { in: reservationIds },
            businessDate: previousAuditDate,
            type: 'CHARGE',
            source: { in: ['ROOM_CHARGE', 'DAY_USE_ROOM_CHARGE'] },
            revenueCategory: 'FNB',
            revenueClass: 'FOOD',
            voidedAt: null,
          },
          select: { reservationId: true },
        })
      : [];
    const qualifiedReservationIds = new Set(priorFoodAllocations.map((item) => item.reservationId).filter(Boolean));

    return successResponse(reservations.map((reservation) => {
      const room = reservation.reservationRooms[0]?.room;
      const folio = reservation.folios[0];
      return {
        reservationId: reservation.id,
        guestId: reservation.primaryGuestId,
        folioId: folio?.id || null,
        folioBalance: Number(folio?.balance || 0),
        outstandingBalance: Math.max(0, Number(folio?.balance || 0)),
        availableCredit: Math.max(0, -Number(folio?.balance || 0)),
        currency: folio?.currency || 'NGN',
        guestName: `${reservation.primaryGuest?.firstName || ''} ${reservation.primaryGuest?.lastName || ''}`.trim() || 'Unknown Guest',
        roomNumber: room?.number || '–',
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        isVip: reservation.primaryGuest?.isVip || false,
        complimentaryFoodQualifiedLastAudit: qualifiedReservationIds.has(reservation.id),
        adults: reservation.adults,
      };
    }));
  } catch (error: any) {
    console.error('[IN_HOUSE_GUESTS_GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to load in-house guests', 500);
  }
}

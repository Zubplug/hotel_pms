import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const EXCLUDED_STATUSES = ['CANCELLED', 'NO_SHOW', 'EXPIRED', 'PENDING'];

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function guestName(guest: { firstName: string; lastName: string }) {
  return `${guest.firstName} ${guest.lastName}`.trim();
}

function displayRoomNumber(value: string | null | undefined) {
  if (!value) return 'Unassigned';
  return value.split('.').filter(Boolean).pop() || value;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) {
      return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    }
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businessDate = new Date(`${businessDateStr}T00:00:00.000Z`);
    if (Number.isNaN(businessDate.getTime()) || dateOnly(businessDate) !== businessDateStr) {
      return errorResponse('BAD_REQUEST', 'businessDate must be an ISO date (YYYY-MM-DD)', 400);
    }

    const [property, nightAudit, reservations] = await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          baseCurrency: true,
          timezone: true,
        },
      }),
      prisma.nightAudit.findUnique({
        where: { propertyId_businessDate: { propertyId, businessDate } },
        select: { status: true, cutoffAt: true, completedAt: true, runReference: true },
      }),
      prisma.reservation.findMany({
        where: {
          propertyId,
          // A historical in-house report is based on the stay interval, not
          // the reservation's current status after a later checkout.
          status: { notIn: EXCLUDED_STATUSES as any },
          reservationRooms: {
            some: {
              status: 'ACTIVE',
              roomId: { not: null },
              checkIn: { lte: businessDate },
              checkOut: { gt: businessDate },
            },
          },
        },
        include: {
          primaryGuest: true,
          corporateAccount: { select: { name: true, code: true } },
          reservationRooms: {
            where: {
              status: 'ACTIVE',
              roomId: { not: null },
              checkIn: { lte: businessDate },
              checkOut: { gt: businessDate },
            },
            include: { room: { include: { roomType: { select: { name: true, code: true } } } } },
            orderBy: { room: { number: 'asc' } },
          },
          folios: {
            where: { status: { not: 'VOID' } },
            select: {
              id: true,
              folioNumber: true,
              type: true,
              currency: true,
              totalCharges: true,
              totalPayments: true,
              balance: true,
            },
          },
          reservationGuests: {
            include: { guest: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: [{ reservationRooms: { _count: 'desc' } }, { primaryGuest: { lastName: 'asc' } }],
      }),
    ]);

    const guests = reservations.flatMap((reservation) => {
      const charges = reservation.folios.reduce((sum, folio) => sum + Number(folio.totalCharges || 0), 0);
      const payments = reservation.folios.reduce((sum, folio) => sum + Number(folio.totalPayments || 0), 0);
      const balance = reservation.folios.reduce((sum, folio) => sum + Number(folio.balance || 0), 0);
      const creditAvailable = Math.max(0, -balance);
      const outstandingBalance = Math.max(0, balance);
      const paymentStatus = outstandingBalance <= 0
        ? (creditAvailable > 0 ? 'CREDIT' : 'PAID')
        : payments > 0 ? 'PARTIAL' : 'UNPAID';
      const primaryRoom = reservation.reservationRooms[0];
      const roomAssignments = reservation.reservationRooms.map((assignment) => ({
        room: displayRoomNumber(assignment.room?.number),
        roomType: assignment.room?.roomType?.name ?? assignment.room?.roomType?.code ?? 'Unassigned',
        rate: Number(assignment.rateAmount || 0),
        adults: assignment.adults,
        children: assignment.children,
      }));
      const totalAdults = reservation.reservationRooms.reduce((sum, room) => sum + room.adults, 0);
      const totalChildren = reservation.reservationRooms.reduce((sum, room) => sum + room.children, 0);
      const occupants = reservation.reservationGuests.map((item) => guestName(item.guest)).filter(Boolean);

      return [{
        id: reservation.id,
        room: displayRoomNumber(primaryRoom?.room?.number),
        roomType: primaryRoom?.room?.roomType?.name ?? primaryRoom?.room?.roomType?.code ?? 'Unassigned',
        roomAssignments,
        guestName: guestName(reservation.primaryGuest),
        phone: reservation.primaryGuest.phone || 'Not recorded',
        email: reservation.primaryGuest.email || 'Not recorded',
        company: reservation.primaryGuest.companyName || reservation.corporateAccount?.name || 'Individual guest',
        corporateAccount: reservation.corporateAccount ? `${reservation.corporateAccount.name} (${reservation.corporateAccount.code})` : '—',
        occupants,
        reservationRef: reservation.confirmationNumber,
        arrival: dateOnly(reservation.checkIn),
        departure: dateOnly(reservation.checkOut),
        nights: Math.max(1, Math.round((reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86400000)),
        adults: totalAdults || reservation.adults || 1,
        children: totalChildren || reservation.children || 0,
        rate: roomAssignments.reduce((sum, room) => sum + room.rate, 0),
        charges,
        payments,
        folioBalance: balance,
        creditAvailable,
        paymentStatus,
        vipStatus: reservation.primaryGuest.isVip ? (reservation.primaryGuest.vipLevel || 'VIP') : 'Regular',
        source: reservation.source,
        status: reservation.status,
        earlyCheckIn: reservation.earlyCheckIn,
        lateCheckOut: reservation.lateCheckOut,
        specialRequests: reservation.specialRequests || '—',
        folioNumbers: reservation.folios.map((folio) => folio.folioNumber),
      }];
    });

    const totals = {
      occupiedRooms: new Set(guests.flatMap((guest) => guest.roomAssignments.map((assignment) => assignment.room)).filter((room) => room !== 'Unassigned')).size,
      reservations: guests.length,
      guestsInHouse: guests.reduce((sum, guest) => sum + guest.adults + guest.children, 0),
      adults: guests.reduce((sum, guest) => sum + guest.adults, 0),
      children: guests.reduce((sum, guest) => sum + guest.children, 0),
      roomCharges: guests.reduce((sum, guest) => sum + guest.charges, 0),
      payments: guests.reduce((sum, guest) => sum + guest.payments, 0),
      outstandingBalances: guests.reduce((sum, guest) => sum + Math.max(0, guest.folioBalance), 0),
      availableCredits: guests.reduce((sum, guest) => sum + guest.creditAvailable, 0),
      unpaid: guests.filter((guest) => guest.paymentStatus === 'UNPAID').length,
      partial: guests.filter((guest) => guest.paymentStatus === 'PARTIAL').length,
      paid: guests.filter((guest) => ['PAID', 'CREDIT'].includes(guest.paymentStatus)).length,
      vip: guests.filter((guest) => guest.vipStatus !== 'Regular').length,
      dueOuts: guests.filter((guest) => guest.departure === businessDateStr).length,
    };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      propertyTimezone: property?.timezone || 'UTC',
      businessDate: businessDateStr,
      asOf: nightAudit?.cutoffAt || nightAudit?.completedAt || null,
      auditStatus: nightAudit?.status || 'NOT_RUN',
      runReference: nightAudit?.runReference || null,
      guests,
      totals,
    });
  } catch (err: any) {
    console.error('[In House Guests GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

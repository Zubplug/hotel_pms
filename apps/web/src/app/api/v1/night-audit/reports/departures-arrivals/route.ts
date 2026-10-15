import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const CLOSED_STATUSES = ['CANCELLED', 'NO_SHOW', 'EXPIRED'];

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function nameOf(guest: { firstName: string; lastName: string }) {
  return `${guest.firstName} ${guest.lastName}`.trim();
}

function amountFor(reservation: any) {
  return reservation.folios.reduce((totals: { charges: number; payments: number; balance: number }, folio: any) => ({
    charges: totals.charges + Number(folio.totalCharges || 0),
    payments: totals.payments + Number(folio.totalPayments || 0),
    balance: totals.balance + Number(folio.balance || 0),
  }), { charges: 0, payments: 0, balance: 0 });
}

function paymentStatus(balance: number, payments: number) {
  if (balance < 0) return 'CREDIT';
  if (balance === 0) return 'PAID';
  return payments > 0 ? 'PARTIAL' : 'UNPAID';
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');
    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businessDate = new Date(`${businessDateStr}T00:00:00.000Z`);
    if (Number.isNaN(businessDate.getTime()) || dateOnly(businessDate) !== businessDateStr) {
      return errorResponse('BAD_REQUEST', 'businessDate must be an ISO date (YYYY-MM-DD)', 400);
    }

    const [property, audit] = await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: { name: true, email: true, phone: true, address: true, city: true, state: true, baseCurrency: true, timezone: true },
      }),
      prisma.nightAudit.findUnique({
        where: { propertyId_businessDate: { propertyId, businessDate } },
        select: {
          status: true,
          cutoffAt: true,
          completedAt: true,
          runReference: true,
          movementSnapshots: {
            select: {
              reservationId: true,
              movementType: true,
              confirmationNumber: true,
              guestName: true,
              roomNumber: true,
              roomType: true,
              source: true,
              status: true,
              adults: true,
              children: true,
              folioBalance: true,
            },
          },
        },
      }),
    ]);

    const snapshots = audit?.movementSnapshots || [];
    const snapshotIds = [...new Set(snapshots.map((row) => row.reservationId))];
    const reservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        OR: [
          ...(snapshotIds.length ? [{ id: { in: snapshotIds } }] : []),
          { checkIn: businessDate },
          { checkOut: businessDate },
        ],
      },
      include: {
        primaryGuest: true,
        corporateAccount: { select: { name: true, code: true } },
        reservationRooms: {
          where: { roomId: { not: null } },
          include: { room: { include: { roomType: { select: { name: true, code: true } } } } },
          orderBy: { room: { number: 'asc' } },
        },
        folios: {
          where: { status: { not: 'VOID' } },
          select: { folioNumber: true, totalCharges: true, totalPayments: true, balance: true },
        },
      },
    });

    const reservationMap = new Map(reservations.map((reservation) => [reservation.id, reservation]));
    const auditCutoff = audit?.completedAt || audit?.cutoffAt || new Date(businessDate.getTime() + 86400000);
    const auditEvents = snapshotIds.length
      ? await prisma.auditLog.findMany({
          where: {
            propertyId,
            resource: 'Reservation',
            resourceId: { in: snapshotIds },
            action: { in: ['RESERVATION_CHECKED_IN', 'RESERVATION_CHECKED_OUT', 'RESERVATION_CHECKED_OUT_CREDIT_TRANSFERRED', 'RESERVATION_CHECKED_OUT_CREDIT_RETAINED', 'RESERVATION_CANCELLED', 'RESERVATION_NO_SHOW_ASSESSED'] },
            createdAt: { lte: auditCutoff },
          },
          select: { resourceId: true, action: true, createdAt: true, newValue: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const latestStatus = new Map<string, string>();
    const eventTimes = new Map<string, { checkedInAt?: string; checkedOutAt?: string }>();
    for (const event of auditEvents) {
      const status = (event.newValue as { status?: string } | null)?.status;
      if (status) latestStatus.set(event.resourceId, status);
      const times = eventTimes.get(event.resourceId) || {};
      if (event.action === 'RESERVATION_CHECKED_IN') times.checkedInAt = event.createdAt.toISOString();
      if (event.action.startsWith('RESERVATION_CHECKED_OUT')) times.checkedOutAt = event.createdAt.toISOString();
      eventTimes.set(event.resourceId, times);
    }

    const snapshotByKey = new Map(snapshots.map((row) => [`${row.reservationId}:${row.movementType}`, row]));
    const historicalMode = snapshots.length > 0;
    const movementIds = (type: string, dateField: 'checkIn' | 'checkOut') => historicalMode
      ? snapshots.filter((row) => row.movementType === type).map((row) => row.reservationId)
      : reservations.filter((row) => dateOnly(row[dateField]) === businessDateStr).map((row) => row.id);

    const toMovement = (reservationId: string, movementType: 'ARRIVAL' | 'DEPARTURE') => {
      const reservation = reservationMap.get(reservationId);
      if (!reservation) return null;
      const snapshot = snapshotByKey.get(`${reservationId}:${movementType}`);
      const financials = amountFor(reservation);
      const assignment = reservation.reservationRooms[0];
      const status = snapshot?.status || latestStatus.get(reservationId) || reservation.status;
      const times = eventTimes.get(reservationId) || {};
      const scheduledDate = movementType === 'ARRIVAL' ? reservation.checkIn : reservation.checkOut;
      const roomAssignments = reservation.reservationRooms.map((room) => ({
        room: room.room?.number || 'Unassigned',
        roomType: room.room?.roomType?.name || room.room?.roomType?.code || 'Unassigned',
        rate: Number(room.rateAmount || 0),
      }));
      return {
        id: reservation.id,
        reservationId: snapshot?.confirmationNumber || reservation.confirmationNumber,
        guestName: snapshot?.guestName || nameOf(reservation.primaryGuest),
        roomNumber: snapshot?.roomNumber || assignment?.room?.number || 'Unassigned',
        roomType: snapshot?.roomType || assignment?.room?.roomType?.name || assignment?.room?.roomType?.code || 'Unassigned',
        roomAssignments,
        phone: reservation.primaryGuest.phone || 'Not recorded',
        email: reservation.primaryGuest.email || 'Not recorded',
        company: reservation.primaryGuest.companyName || reservation.corporateAccount?.name || '—',
        corporateAccount: reservation.corporateAccount ? `${reservation.corporateAccount.name} (${reservation.corporateAccount.code})` : '—',
        arrival: dateOnly(reservation.checkIn),
        departure: dateOnly(reservation.checkOut),
        nights: Math.max(1, Math.round((reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86400000)),
        adults: snapshot?.adults ?? reservation.adults,
        children: snapshot?.children ?? reservation.children,
        rate: roomAssignments.reduce((sum, room) => sum + room.rate, 0),
        charges: financials.charges,
        payments: financials.payments,
        balance: snapshot ? Number(snapshot.folioBalance || 0) : financials.balance,
        paymentStatus: paymentStatus(snapshot ? Number(snapshot.folioBalance || 0) : financials.balance, financials.payments),
        status,
        scheduledDate: dateOnly(scheduledDate),
        checkedInAt: times.checkedInAt || null,
        checkedOutAt: times.checkedOutAt || null,
        source: snapshot?.source || String(reservation.source),
        vipStatus: reservation.primaryGuest.isVip ? (reservation.primaryGuest.vipLevel || 'VIP') : 'Regular',
        specialRequests: reservation.specialRequests || '—',
        earlyCheckIn: reservation.earlyCheckIn,
        lateCheckOut: reservation.lateCheckOut,
        folioNumbers: reservation.folios.map((folio) => folio.folioNumber),
      };
    };

    const build = (type: 'ARRIVAL' | 'DEPARTURE') => movementIds(type, type === 'ARRIVAL' ? 'checkIn' : 'checkOut')
      .map((id) => toMovement(id, type)).filter(Boolean) as any[];
    const arrivals = build('ARRIVAL');
    const departures = build('DEPARTURE');
    const cancelled = historicalMode
      ? snapshots.filter((row) => row.movementType === 'CANCELLATION').map((row) => {
          const movement = toMovement(row.reservationId, 'ARRIVAL');
          return movement ? { ...movement, status: 'CANCELLED' } : null;
        }).filter(Boolean) as any[]
      : reservations.filter((reservation) => dateOnly(reservation.checkIn) === businessDateStr && reservation.status === 'CANCELLED').map((reservation) => toMovement(reservation.id, 'ARRIVAL')).filter(Boolean) as any[];
    const noShows = arrivals.filter((row) => row.status === 'NO_SHOW');
    const pending = arrivals.filter((row) => row.status === 'PENDING' || row.status === 'CONFIRMED');
    const checkedInArrivals = arrivals.filter((row) => row.status === 'CHECKED_IN');
    const completedDepartures = departures.filter((row) => row.status === 'CHECKED_OUT');
    const outstandingDepartures = departures.filter((row) => row.status !== 'CHECKED_OUT');

    const metrics = {
      arrivals: arrivals.length,
      checkedInArrivals: checkedInArrivals.length,
      pendingArrivals: pending.length,
      noShows: noShows.length,
      cancellations: cancelled.length,
      departures: departures.length,
      completedDepartures: completedDepartures.length,
      outstandingDepartures: outstandingDepartures.length,
      dueOutBalances: departures.reduce((sum, row) => sum + Math.max(0, row.balance), 0),
      arrivalBalances: arrivals.reduce((sum, row) => sum + Math.max(0, row.balance), 0),
      vipMovements: [...arrivals, ...departures].filter((row) => row.vipStatus !== 'Regular').length,
    };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      propertyTimezone: property?.timezone || 'UTC',
      businessDate: businessDateStr,
      asOf: audit?.cutoffAt || audit?.completedAt || null,
      auditStatus: audit?.status || 'NOT_RUN',
      runReference: audit?.runReference || null,
      historicalSource: historicalMode ? 'NIGHT_AUDIT_MOVEMENT_SNAPSHOT' : 'LIVE_RESERVATION_FALLBACK',
      expectedArrivals: arrivals,
      expectedDepartures: departures,
      checkedInArrivals,
      completedDepartures,
      outstandingDepartures,
      noShows,
      cancelled,
      metrics,
    });
  } catch (err: any) {
    console.error('[Departures Arrivals GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

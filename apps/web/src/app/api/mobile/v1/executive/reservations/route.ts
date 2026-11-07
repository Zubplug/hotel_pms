import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';
const asNumber = (value: unknown) => Number(value ?? 0);
const RESERVATION_OVERSIGHT_ROLES = [
  'ADMIN',
  'MANAGER',
  'DIRECTOR',
  'EXECUTIVE',
  'GENERAL_MANAGER',
  'CEO',
  'SUPER_ADMIN',
  'NIGHT_AUDITOR',
];

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (user.isSuperAdmin !== true && !RESERVATION_OVERSIGHT_ROLES.includes(user.role)) return errorResponse('FORBIDDEN', 'Executive or Management access required', 403);
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
          // A reassignment leaves the old row on the reservation history. The
          // mobile detail view must show the current room assignment only.
          reservationRooms: { where: { status: 'ACTIVE' }, include: { room: { select: { id: true, number: true, displayName: true } } }, orderBy: { checkIn: 'asc' } },
          folios: {
            where: { status: { not: 'VOID' } },
            orderBy: { createdAt: 'asc' },
            include: {
              items: { where: { voidedAt: null }, orderBy: { businessDate: 'asc' }, take: 100 },
              payments: { where: { status: { in: ['COMPLETED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' }, take: 100 },
              credits: { where: { status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] } }, orderBy: { createdAt: 'asc' } },
              creditApplications: { orderBy: { createdAt: 'desc' }, take: 100 },
            },
          },
        },
      });
      if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
      const guestCreditAvailable = await getGuestCreditAvailable(reservation.primaryGuestId);
      return successResponse({ reservation: serializeReservation(reservation, true, guestCreditAvailable) }, 200);
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } });
    const date = params.get('date') || property?.businessDate?.toISOString().slice(0, 10);
    if (!date) return errorResponse('BAD_REQUEST', 'Property business date is unavailable', 400);
    const day = new Date(`${date}T00:00:00.000Z`);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const reservations = await prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, OR: [
        // Status is authoritative for current in-house guests. Do not hide a
        // still CHECKED_IN guest merely because the scheduled checkout date is
        // today; the record remains visible until checkout changes the status.
        { status: 'CHECKED_IN' },
        { status: 'NO_SHOW', checkIn: day },
        // Reserved is a management register, not a daily arrival list. Keep
        // every active confirmed/pending reservation visible regardless of its
        // arrival date; checked-in and no-show remain business-date scoped.
        { status: { in: ['CONFIRMED', 'PENDING'] } },
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

async function getGuestCreditAvailable(guestId: string | null | undefined) {
  if (!guestId) return 0;
  const entries = await prisma.cityLedgerEntry.findMany({
    where: { guestId, type: 'REFUND_OWED', status: 'OPEN' },
    include: { allocations: { select: { amount: true } } },
  });
  return entries.reduce((sum, entry) => {
    const allocated = entry.allocations.reduce((entrySum, allocation) => entrySum + asNumber(allocation.amount), 0);
    return sum + Math.max(0, asNumber(entry.amount) - allocated);
  }, 0);
}

function serializeReservation(reservation: any, detailed = false, guestCreditAvailable = 0) {
  const guest = reservation.primaryGuest;
  const folios = reservation.folios || [];
  // Closed folios remain visible in the detail history, but they must not be
  // counted as current checkout debt. Only open folios represent the amount
  // that can still be settled or transferred at departure.
  const openFolios = folios.filter((folio: any) => folio.status === 'OPEN');
  const category = reservation.status === 'CHECKED_IN' ? 'CHECKED_IN' : reservation.status === 'NO_SHOW' ? 'NO_SHOW' : 'RESERVED';
  const totalCharges = openFolios.reduce((sum: number, folio: any) => sum + asNumber(folio.totalCharges), 0);
  const totalPayments = openFolios.reduce((sum: number, folio: any) => sum + asNumber(folio.totalPayments), 0);
  const signedBalance = Math.round((totalCharges - totalPayments) * 100) / 100;
  const availableFolioCredit = openFolios.reduce((sum: number, folio: any) => sum + (folio.credits || []).reduce((creditSum: number, credit: any) => creditSum + asNumber(credit.remainingAmount), 0), 0);
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
    rooms: (reservation.reservationRooms || [])
      .filter((room: any) => room.status === 'ACTIVE')
      .map((room: any) => ({ id: room.id, number: room.room?.number || 'Unassigned', status: room.status, rateAmount: asNumber(room.rateAmount), checkIn: room.checkIn, checkOut: room.checkOut, discountType: room.discountType || null, discountAmount: asNumber(room.discountAmount), discountPercent: asNumber(room.discountPercent), discountReason: room.discountReason || null })),
    balanceSummary: {
      currency: folios[0]?.currency || reservation.currency || 'NGN',
      charges: totalCharges,
      payments: totalPayments,
      credit: availableFolioCredit + guestCreditAvailable,
      balance: signedBalance,
      outstanding: Math.max(0, signedBalance),
      inDebt: signedBalance > 0.01,
    },
    folios: detailed ? folios.map((item: any) => ({
      id: item.id,
      folioNumber: item.folioNumber,
      type: item.type,
      status: item.status,
      currency: item.currency,
      totalCharges: asNumber(item.totalCharges),
      totalPayments: asNumber(item.totalPayments),
      balance: Math.round((asNumber(item.totalCharges) - asNumber(item.totalPayments)) * 100) / 100,
      availableCredit: (item.credits || []).reduce((sum: number, credit: any) => sum + asNumber(credit.remainingAmount), 0),
      credits: (item.credits || []).map((credit: any) => ({
        id: credit.id,
        amount: asNumber(credit.amount),
        remainingAmount: asNumber(credit.remainingAmount),
        currency: credit.currency,
        method: credit.method,
        status: credit.status,
        reference: credit.reference,
        notes: credit.notes,
        businessDate: credit.businessDate,
        approvalStatus: credit.approvalStatus,
        createdAt: credit.createdAt,
      })),
      payments: (item.payments || []).map((payment: any) => ({
        id: payment.id,
        type: 'PAYMENT',
        description: `${payment.method || 'Payment'} payment${payment.reference ? ` · ${payment.reference}` : ''}`,
        amount: asNumber(payment.amount),
        currency: payment.currency,
        status: payment.status,
        businessDate: payment.businessDate,
        createdAt: payment.createdAt,
        collectionSource: payment.collectionSource,
        reference: payment.reference || payment.receiptNumber,
      })),
      creditApplications: (item.creditApplications || []).map((application: any) => ({
        id: application.id,
        type: 'CREDIT_APPLICATION',
        description: application.description || 'Advanced credit applied',
        amount: asNumber(application.amount),
        currency: application.currency,
        businessDate: application.businessDate,
        createdAt: application.createdAt,
        source: application.source,
      })),
      items: (item.items || []).map((line: any) => ({ id: line.id, businessDate: line.businessDate, type: line.type, description: line.description, amount: asNumber(line.amount), currency: line.currency, revenueCategory: line.revenueCategory }))
    })) : folios.map((item: any) => ({ totalCharges: asNumber(item.totalCharges), totalPayments: asNumber(item.totalPayments), balance: Math.round((asNumber(item.totalCharges) - asNumber(item.totalPayments)) * 100) / 100, currency: item.currency })),
  };
}

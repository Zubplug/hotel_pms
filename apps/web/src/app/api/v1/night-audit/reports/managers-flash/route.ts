/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const round = (value: number) => Math.round(value * 100) / 100;
const money = (value: unknown) => Number(value || 0);

function classify(source: string, category: string, revenueClass: string | null) {
  const sourceName = source.toUpperCase();
  const className = String(revenueClass || '').toUpperCase();
  if (className === 'HALL') return 'Events · Hall';
  if (className === 'EQUIPMENT') return 'Events · Equipment';
  if (className === 'FOOD' && sourceName === 'OTHER') return 'Events · Food';
  if (sourceName === 'ROOM_CHARGE' || sourceName === 'DAY_USE_ROOM_CHARGE') {
    if (category === 'FNB') return 'F&B';
    if (category === 'OTHER') return 'Service Charge';
    return 'Rooms';
  }
  if (sourceName === 'POS' || sourceName === 'RESTAURANT' || sourceName === 'BAR' || category === 'FNB') return 'F&B';
  const labels: Record<string, string> = { SPA: 'Spa', LAUNDRY: 'Laundry', TRANSPORT: 'Transport', TELEPHONE: 'Telephone', INTERNET: 'Internet', MINIBAR: 'Minibar', CITY_LEDGER: 'City Ledger', MANUAL: 'Other' };
  return labels[sourceName] || 'Other';
}

function movementRow(reservation: any) {
  const firstRoom = reservation.reservationRooms?.[0];
  const balance = (reservation.folios || []).reduce((sum: number, folio: any) => sum + money(folio.balance), 0);
  const internalRoomNumber = firstRoom?.room?.number;
  const roomNumber = internalRoomNumber ? String(internalRoomNumber).split('.').pop() || String(internalRoomNumber) : 'Unassigned';
  return {
    reservationId: reservation.confirmationNumber,
    guestName: `${reservation.primaryGuest?.firstName || ''} ${reservation.primaryGuest?.lastName || ''}`.trim() || 'Unknown guest',
    roomNumber,
    roomType: firstRoom?.room?.roomType?.name || 'Unassigned',
    adults: reservation.adults,
    children: reservation.children,
    source: reservation.source,
    status: reservation.status,
    balance: round(balance),
    specialRequests: reservation.specialRequests || '',
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const role = String((session.user as any).role || '').toUpperCase();
    const allowedRoles = ['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO', 'GENERAL_MANAGER', 'DIRECTOR', 'FINANCE_MANAGER', 'GENERAL_CASHIER'];
    if (!allowedRoles.includes(role) && !(session.user as any).isSuperAdmin) return errorResponse('FORBIDDEN', 'Insufficient permissions to view managers flash report', 403);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const businessDateValue = req.nextUrl.searchParams.get('businessDate');
    if (!propertyId || !businessDateValue) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDateValue)) return errorResponse('BAD_REQUEST', 'businessDate must be YYYY-MM-DD', 400);
    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId) && !(session.user as any).isSuperAdmin) return errorResponse('FORBIDDEN', 'Property access denied', 403);

    const businessDate = new Date(`${businessDateValue}T00:00:00.000Z`);
    const [property, audit, rooms, snapshot, folioItems, posOrders, arrivals, departures, inHouseReservations, roomStatuses, payments, posPayments, posSessions, frontdeskSessions, attendance, rosters, housekeeping, openPosOrders, transactionExceptions, reconciliationExceptions, outstandingFolios, guestCredits, guestRefundEntries, corporateAccountRegistry, cityLedgerFolios, cityLedgerInvoices, orphanCityLedgerFolioCount, cityLedgerItems, cityLedgerPayments, serviceRequests] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, email: true, phone: true, address: true, city: true, state: true, baseCurrency: true, timezone: true } }),
      prisma.nightAudit.findUnique({ where: { propertyId_businessDate: { propertyId, businessDate } }, include: { financialSnapshot: true, movementSnapshots: { orderBy: [{ movementType: 'asc' }, { guestName: 'asc' }] }, closePackage: { select: { status: true, packageHash: true, finalizedAt: true, balanceProof: true, controlSummary: true } } } }),
      prisma.room.findMany({ where: { propertyId, isActive: true, deletedAt: null }, select: { id: true, number: true, status: true, roomType: { select: { name: true } } } }),
      prisma.occupancySnapshot.findUnique({ where: { propertyId_businessDate: { propertyId, businessDate } } }),
      prisma.folioItem.findMany({ where: { folio: { propertyId }, businessDate, voidedAt: null }, select: { type: true, source: true, revenueCategory: true, revenueClass: true, amount: true, description: true, posTransactionId: true } }),
      prisma.posOrder.findMany({ where: { propertyId, businessDate, status: 'CLOSED', payments: { some: { status: { in: ['CONFIRMED', 'PAID'] } } } }, select: { id: true, total: true, guestCount: true, outlet: { select: { name: true, type: true } }, payments: { where: { status: { in: ['CONFIRMED', 'PAID'] } }, select: { amount: true, method: true } } } }),
      prisma.reservation.findMany({ where: { propertyId, checkIn: businessDate }, include: { primaryGuest: { select: { firstName: true, lastName: true } }, reservationRooms: { include: { room: { include: { roomType: { select: { name: true } } } } } }, folios: { select: { balance: true } } }, orderBy: { createdAt: 'asc' }, take: 100 }),
      prisma.reservation.findMany({ where: { propertyId, checkOut: businessDate }, include: { primaryGuest: { select: { firstName: true, lastName: true } }, reservationRooms: { include: { room: { include: { roomType: { select: { name: true } } } } } }, folios: { select: { balance: true } } }, orderBy: { checkOut: 'asc' }, take: 100 }),
      prisma.reservation.findMany({ where: { propertyId, status: 'CHECKED_IN', checkIn: { lte: businessDate }, checkOut: { gt: businessDate } }, select: { adults: true, children: true } }),
      prisma.room.groupBy({ by: ['status'], where: { propertyId, isActive: true, deletedAt: null }, _count: { id: true } }),
      prisma.payment.groupBy({ by: ['method'], where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: { id: true } }),
      prisma.posPayment.groupBy({ by: ['method'], where: { businessDate, status: { in: ['CONFIRMED', 'PAID'] }, order: { propertyId } }, _sum: { amount: true }, _count: { id: true } }),
      prisma.posSession.findMany({ where: { propertyId, businessDate }, select: { id: true, status: true, controlStatus: true, outlet: { select: { name: true } }, expectedCash: true, actualCash: true, variance: true } }),
      prisma.frontdeskSession.findMany({ where: { propertyId, businessDate }, select: { id: true, status: true, controlStatus: true, shiftReference: true, systemExpectedCash: true, declaredCash: true, variance: true } }),
      prisma.attendanceRecord.findMany({ where: { propertyId, date: businessDate }, select: { status: true, clockIn: true, clockOut: true } }),
      prisma.shiftRoster.findMany({ where: { propertyId, date: businessDate, status: { not: 'CANCELLED' } }, select: { status: true, publicationStatus: true } }),
      prisma.housekeepingTask.groupBy({ by: ['status'], where: { propertyId, businessDate }, _count: { id: true } }),
      prisma.posOrder.count({ where: { propertyId, businessDate, status: { not: 'CLOSED' } } }),
      prisma.transactionException.findMany({ where: { propertyId, businessDate: { gte: businessDate, lt: new Date(businessDate.getTime() + 86400000) }, status: { in: ['OPEN', 'PENDING_APPROVAL'] } }, select: { id: true, status: true, questionReason: true, proposedResolution: true, resolutionNotes: true } }),
      prisma.reconciliationException.findMany({ where: { propertyId, status: 'OPEN', frontdeskSession: { businessDate } }, select: { id: true, type: true, severity: true, amount: true, source: true, reason: true, status: true, frontdeskSession: { select: { shiftReference: true } } } }),
      prisma.folio.findMany({ where: { propertyId, reservation: { status: 'CHECKED_IN' } }, select: { balance: true } }),
      prisma.folioCredit.aggregate({ where: { propertyId, status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] }, folio: { type: { not: 'CITY_LEDGER' } } }, _sum: { remainingAmount: true } }),
      prisma.cityLedgerEntry.findMany({ where: { propertyId, type: 'REFUND_OWED', status: 'OPEN' }, select: { amount: true, allocations: { select: { amount: true } } } }),
      prisma.corporateAccount.findMany({ where: { propertyId, isActive: true }, select: { name: true, code: true, creditLimit: true, exemptFromHighBalance: true, cityLedgerAccount: { select: { entries: { where: { type: 'PAYMENT', status: { not: 'REVERSED' } }, select: { amount: true, allocations: { select: { amount: true } } } } } } } }),
      prisma.folio.findMany({ where: { propertyId, type: 'CITY_LEDGER', status: { not: 'VOID' }, corporateAccountId: { not: null } }, select: { id: true, balance: true, totalCharges: true, totalPayments: true, corporateAccount: { select: { name: true, code: true, creditLimit: true, exemptFromHighBalance: true, cityLedgerAccount: { select: { balance: true } } } } } }),
      prisma.cityLedgerInvoice.findMany({ where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, account: { CorporateAccount: { some: { isActive: true } } } }, select: { outstandingAmount: true, account: { select: { CorporateAccount: { where: { isActive: true }, select: { name: true, code: true, creditLimit: true, exemptFromHighBalance: true } } } } } }),
      prisma.folio.count({ where: { propertyId, type: 'CITY_LEDGER', status: { not: 'VOID' }, corporateAccountId: null } }),
      prisma.folioItem.findMany({ where: { businessDate, voidedAt: null, folio: { propertyId, type: 'CITY_LEDGER', status: { not: 'VOID' }, corporateAccountId: { not: null } } }, select: { type: true, amount: true, revenueCategory: true, description: true, folio: { select: { corporateAccount: { select: { name: true, code: true } } } } } }),
      prisma.payment.findMany({ where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] }, folio: { type: 'CITY_LEDGER', status: { not: 'VOID' }, corporateAccountId: { not: null } } }, select: { amount: true, method: true, folio: { select: { corporateAccount: { select: { name: true, code: true } } } } } }),
      prisma.guestServiceRequest.groupBy({ by: ['status'], where: { propertyId, requestedAt: { gte: businessDate, lt: new Date(businessDate.getTime() + 86400000) } }, _count: { id: true } }),
    ]);
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    // Prefer the immutable movement register captured by Night Audit. The
    // audit-log fallback preserves historical reports created before the
    // movement snapshot migration was deployed.
    const movementReservationIds = [...arrivals, ...departures].map((row) => row.id);
    const auditCutoff = audit?.completedAt || audit?.cutoffAt || new Date(businessDate.getTime() + 86400000);
    const movementAudits = movementReservationIds.length
      ? await prisma.auditLog.findMany({
          where: {
            propertyId,
            resource: 'Reservation',
            resourceId: { in: movementReservationIds },
            action: { in: ['RESERVATION_CHECKED_IN', 'RESERVATION_CHECKED_OUT', 'RESERVATION_CHECKED_OUT_CREDIT_TRANSFERRED', 'RESERVATION_CHECKED_OUT_CREDIT_RETAINED', 'RESERVATION_CANCELLED', 'RESERVATION_NO_SHOW_ASSESSED'] },
            createdAt: { lte: auditCutoff },
          },
          select: { resourceId: true, newValue: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const statusAtAudit = new Map<string, string>();
    for (const entry of movementAudits) {
      const status = (entry.newValue as { status?: string } | null)?.status;
      if (status) statusAtAudit.set(entry.resourceId, status);
    }
    const snapshotMovements = audit?.movementSnapshots || [];
    const snapshotMovement = (row: (typeof snapshotMovements)[number]) => ({
      reservationId: row.confirmationNumber,
      guestName: row.guestName.replace(/\s+/g, ' ').trim(),
      roomNumber: row.roomNumber ? String(row.roomNumber).split('.').pop() || String(row.roomNumber) : 'Unassigned',
      roomType: row.roomType || 'Unassigned',
      adults: row.adults,
      children: row.children,
      source: row.source || 'AUDIT_SNAPSHOT',
      status: row.status,
      balance: round(Number(row.folioBalance || 0)),
      specialRequests: '',
    });
    const historicalMovement = (row: any) => ({ ...row, status: statusAtAudit.get(row.id) || row.status });
    const historicalArrivals = snapshotMovements.length
      ? snapshotMovements.filter((row) => row.movementType === 'ARRIVAL').map(snapshotMovement)
      : arrivals.map(historicalMovement);
    const historicalDepartures = snapshotMovements.length
      ? snapshotMovements.filter((row) => row.movementType === 'DEPARTURE').map(snapshotMovement)
      : departures.map(historicalMovement);
    const historicalCancellations = snapshotMovements.length
      ? snapshotMovements.filter((row) => row.movementType === 'CANCELLATION').map(snapshotMovement)
      : [];

    const departments = new Map<string, { department: string; gross: number; discounts: number; adjustments: number; refunds: number; taxes: number; net: number; transactionCount: number }>();
    const representedPosOrders = new Set<string>();
    for (const item of folioItems) {
      const department = classify(String(item.source), String(item.revenueCategory), item.revenueClass);
      const row = departments.get(department) || { department, gross: 0, discounts: 0, adjustments: 0, refunds: 0, taxes: 0, net: 0, transactionCount: 0 };
      const amount = money(item.amount);
      if (item.posTransactionId) representedPosOrders.add(item.posTransactionId);
      if (item.type === 'CHARGE') { row.gross += amount; row.net += amount; row.transactionCount += 1; }
      else if (item.type === 'TAX') { row.taxes += amount; }
      else if (item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY') { row.discounts += Math.abs(amount); row.net -= Math.abs(amount); }
      else if (item.type === 'ADJUSTMENT') { row.adjustments += Math.abs(amount); row.net -= Math.abs(amount); }
      else if (item.type === 'REFUND') { row.refunds += Math.abs(amount); row.net -= Math.abs(amount); }
      departments.set(department, row);
    }
    for (const order of posOrders) {
      if (representedPosOrders.has(order.id)) continue;
      const complimentary = order.payments.filter((payment) => String(payment.method) === 'COMPLIMENTARY').reduce((sum, payment) => sum + money(payment.amount), 0);
      const amount = Math.max(0, money(order.total) - complimentary);
      // Outlet is an operational sales channel, not a financial department.
      // Keep the manager's flash department totals normalized to F&B so an
      // outlet name cannot appear as a separate department.
      const department = 'F&B';
      const row = departments.get(department) || { department, gross: 0, discounts: 0, adjustments: 0, refunds: 0, taxes: 0, net: 0, transactionCount: 0 };
      row.gross += amount; row.net += amount; row.transactionCount += 1; departments.set(department, row);
    }

    const complimentaryRoom = folioItems
      .filter((item) => item.type === 'COMPLIMENTARY' && item.source === 'ROOM_CHARGE' && item.revenueCategory === 'ROOM')
      .reduce((sum, item) => sum + Math.abs(money(item.amount)), 0);
    const complimentaryFood = folioItems
      .filter((item) => item.type === 'CHARGE' && item.source === 'ROOM_CHARGE' && item.revenueCategory === 'FNB' && String(item.revenueClass || '').toUpperCase() === 'FOOD')
      .reduce((sum, item) => sum + money(item.amount), 0);
    const complimentaryPos = posOrders
      .reduce((sum, order) => sum + order.payments.filter((payment) => String(payment.method).toUpperCase() === 'COMPLIMENTARY').reduce((inner, payment) => inner + money(payment.amount), 0), 0);

    const derived = { gross: 0, discounts: 0, adjustments: 0, refunds: 0, taxes: 0, net: 0 };
    for (const row of departments.values()) { derived.gross += row.gross; derived.discounts += row.discounts; derived.adjustments += row.adjustments; derived.refunds += row.refunds; derived.taxes += row.taxes; derived.net += row.net; }
    const financial = audit?.financialSnapshot;
    const roomRevenueAmount = money(financial?.roomRevenue) || money(audit?.totalRoomRevenue);
    const fnbRevenueAmount = money(financial?.fnbRevenue) || [...departments.values()].filter((row) => row.department === 'F&B').reduce((sum, row) => sum + row.gross, 0);
    const serviceChargeAmount = [...departments.values()].filter((row) => row.department === 'Service Charge').reduce((sum, row) => sum + row.gross, 0);
    const otherRevenueAmount = financial ? Math.max(0, money(financial.otherRevenue) - serviceChargeAmount) : Math.max(0, derived.gross - roomRevenueAmount - fnbRevenueAmount - serviceChargeAmount);
    const otherRevenueDetails = [...departments.values()].filter((row) => !['Rooms', 'F&B', 'Service Charge'].includes(row.department)).map((row) => ({ department: row.department, gross: round(row.gross), net: round(row.net), transactionCount: row.transactionCount }));
    const outstandingDue = outstandingFolios.reduce((sum, folio) => sum + Math.max(0, money(folio.balance)), 0);
    const guestCreditBalance = money(guestCredits._sum.remainingAmount);
    const guestRefundLiability = guestRefundEntries.reduce((sum, entry) => sum + Math.max(0, money(entry.amount) - entry.allocations.reduce((allocated, allocation) => allocated + money(allocation.amount), 0)), 0);
    const cityLedgerSales = cityLedgerItems.filter((item) => item.type === 'CHARGE').reduce((sum, item) => sum + Math.max(0, money(item.amount)), 0);
    const cityLedgerSettlements = cityLedgerPayments.reduce((sum, payment) => sum + Math.max(0, money(payment.amount)), 0);
    const cityLedgerCredits = cityLedgerFolios.reduce((sum, folio) => sum + Math.max(0, -money(folio.balance)), 0);
    const corporateMap = new Map<string, { name: string; code: string; balance: number; ledgerBalance: number; advanceCredit: number; creditLimit: number; exemptFromHighBalance: boolean }>();
    for (const account of corporateAccountRegistry) {
      const advanceCredit = account.cityLedgerAccount?.entries.reduce((sum, payment) => sum + Math.max(0, money(payment.amount) - payment.allocations.reduce((allocated, allocation) => allocated + money(allocation.amount), 0)), 0) || 0;
      corporateMap.set(account.code, { name: account.name, code: account.code, balance: 0, ledgerBalance: 0, advanceCredit, creditLimit: money(account.creditLimit), exemptFromHighBalance: Boolean(account.exemptFromHighBalance) });
    }
    for (const folio of cityLedgerFolios) {
      const account = folio.corporateAccount;
      const key = account?.code || account?.name || 'Unassigned city ledger';
      const row = corporateMap.get(key) || { name: account?.name || 'Unapplied city-ledger credits', code: account?.code || '—', balance: 0, ledgerBalance: money(account?.cityLedgerAccount?.balance), advanceCredit: 0, creditLimit: money(account?.creditLimit), exemptFromHighBalance: Boolean(account?.exemptFromHighBalance) };
      row.balance += money(folio.balance);
      row.ledgerBalance = money(account?.cityLedgerAccount?.balance);
      corporateMap.set(key, row);
    }
    for (const invoice of cityLedgerInvoices) {
      const account = invoice.account.CorporateAccount[0];
      if (!account) continue;
      const row = corporateMap.get(account.code) || { name: account.name, code: account.code, balance: 0, ledgerBalance: 0, advanceCredit: 0, creditLimit: money(account.creditLimit), exemptFromHighBalance: Boolean(account.exemptFromHighBalance) };
      row.balance += Math.max(0, money(invoice.outstandingAmount));
      corporateMap.set(account.code, row);
    }
    const corporateAccounts = [...corporateMap.values()].map((row) => ({ ...row, balance: round(row.balance), ledgerBalance: round(row.ledgerBalance), advanceCredit: round(row.advanceCredit), amountDue: round(Math.max(0, row.balance)), creditBalance: round(Math.max(0, -row.balance)), unapplied: row.code === '—' && row.balance < 0, overLimit: !row.exemptFromHighBalance && row.creditLimit > 0 && row.balance > row.creditLimit })).sort((a, b) => b.balance - a.balance || b.advanceCredit - a.advanceCredit);
    const unappliedCityLedgerCredit = corporateAccounts.filter((row) => row.unapplied).reduce((sum, row) => sum + row.creditBalance, 0);
    const corporateAdvanceCredits = corporateAccounts.reduce((sum, row) => sum + row.advanceCredit, 0);
    const cityLedgerBalance = corporateAccounts.reduce((sum, row) => sum + row.amountDue, 0);
    const revenue = {
      room: roomRevenueAmount,
      fb: fnbRevenueAmount,
      serviceCharge: serviceChargeAmount,
      other: otherRevenueAmount,
      gross: money(financial?.grossRevenue) || derived.gross,
      discounts: money(financial?.discounts) || derived.discounts,
      adjustments: derived.adjustments,
      refunds: money(financial?.refunds) || derived.refunds,
      taxes: money(financial?.taxes) || derived.taxes,
      net: money(financial?.netRevenue) || Math.max(0, derived.net),
    };
    const paymentMap = new Map<string, { method: string; amount: number; count: number }>();
    for (const payment of [...payments, ...posPayments]) { const row = paymentMap.get(String(payment.method)) || { method: String(payment.method), amount: 0, count: 0 }; row.amount += money(payment._sum.amount); row.count += payment._count.id; paymentMap.set(row.method, row); }
    const paymentTotals = [...paymentMap.values()].map((row) => ({ ...row, amount: round(row.amount) }));
    const paymentByMethod = (names: string[]) => paymentTotals.filter((row) => names.includes(row.method)).reduce((sum, row) => sum + row.amount, 0);

    const roomCount = (status: string) => roomStatuses.find((row) => row.status === status)?._count.id || 0;
    const totalRooms = snapshot?.totalRooms ?? rooms.length;
    const outOfOrder = snapshot?.outOfOrderRooms ?? roomCount('OUT_OF_ORDER');
    const outOfService = snapshot?.outOfServiceRooms ?? (roomCount('OUT_OF_SERVICE') + roomCount('MAINTENANCE'));
    const blocked = snapshot?.blockedRooms ?? roomCount('BLOCKED');
    const occupiedRooms = snapshot?.occupiedRooms ?? roomCount('OCCUPIED');
    const calculatedAvailableRooms = Math.max(0, totalRooms - occupiedRooms - outOfOrder - outOfService - blocked);
    const sourceAvailableRooms = snapshot?.availableRooms ?? calculatedAvailableRooms;
    const availableRooms = calculatedAvailableRooms;
    const inventoryVariance = sourceAvailableRooms - calculatedAvailableRooms;
    const inHouseGuests = inHouseReservations.reduce((sum, reservation) => sum + reservation.adults + reservation.children, 0);
    const occupancyPercentage = snapshot ? money(snapshot.occupancyPct) : totalRooms ? round((occupiedRooms / totalRooms) * 100) : 0;
    const adr = money(snapshot?.adr) || money(audit?.adr) || (occupiedRooms ? revenue.room / occupiedRooms : 0);
    const revpar = money(snapshot?.revpar) || money(audit?.revpar) || (availableRooms ? revenue.room / availableRooms : 0);
    const hours = attendance.reduce((sum, record) => sum + (record.clockIn && record.clockOut ? Math.max(0, new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 3600000 : 0), 0);
    const housekeepingTotals = housekeeping.map((row) => ({ status: row.status, count: row._count.id }));
    const sessions = [...posSessions.map((row) => ({ id: row.id, type: 'POS', name: row.outlet?.name || 'POS', status: row.controlStatus || row.status, expectedCash: money(row.expectedCash), declaredCash: money(row.actualCash), variance: money(row.variance) })), ...frontdeskSessions.map((row) => ({ id: row.id, type: 'Front Desk', name: row.shiftReference, status: row.controlStatus || row.status, expectedCash: money(row.systemExpectedCash), declaredCash: money(row.declaredCash), variance: money(row.variance) }))];
    const sessionCash = { expected: round(sessions.reduce((sum, row) => sum + row.expectedCash, 0)), declared: round(sessions.reduce((sum, row) => sum + row.declaredCash, 0)), variance: round(sessions.reduce((sum, row) => sum + row.variance, 0)) };
    const cancelledArrivals = snapshotMovements.length ? historicalCancellations : historicalArrivals.filter((row) => row.status === 'CANCELLED');
    const cancelledDepartures = snapshotMovements.length ? [] : historicalDepartures.filter((row) => row.status === 'CANCELLED');
    const actualArrivals = historicalArrivals.filter((row) => row.status !== 'CANCELLED');
    const actualDepartures = historicalDepartures.filter((row) => row.status !== 'CANCELLED');
    const controls = { unresolvedTransactionExceptions: transactionExceptions.length, openReconciliationExceptions: reconciliationExceptions.length, transactionExceptionDetails: transactionExceptions, reconciliationExceptionDetails: reconciliationExceptions.map((row) => ({ ...row, amount: money(row.amount), session: row.frontdeskSession?.shiftReference || null })), openPosOrders, voids: folioItems.filter((item) => item.type === 'VOID').length, adjustments: folioItems.filter((item) => item.type === 'ADJUSTMENT').length, latePostings: await prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }) };

    const report = {
      propertyName: property.name, propertyEmail: property.email || '', propertyPhone: property.phone || '', propertyAddress: [property.address, property.city, property.state].filter(Boolean).join(', '), propertyCurrency: property.baseCurrency || 'NGN', timezone: property.timezone, businessDate: businessDateValue,
      audit: { status: audit?.status || 'NOT_RUN', startedAt: audit?.startedAt, cutoffAt: audit?.cutoffAt, completedAt: audit?.completedAt, runReference: audit?.runReference, roomChargesPosted: audit?.roomChargesPosted || 0, errors: audit?.errors || 0, closePackageStatus: audit?.closePackage?.status || 'NOT_FINALIZED', packageHash: audit?.closePackage?.packageHash || null, reconciliationStatus: financial?.reconciliationStatus || null },
      occupancy: { totalRooms, available: availableRooms, sourceAvailable: sourceAvailableRooms, inventoryVariance, occupied: occupiedRooms, outOfOrder, outOfService, blocked, percentage: round(occupancyPercentage), inHouseGuests, arrivals: actualArrivals.length, checkedInArrivals: actualArrivals.filter((row) => row.status === 'CHECKED_IN').length, departures: actualDepartures.length, completedDepartures: actualDepartures.filter((row) => row.status === 'CHECKED_OUT').length, noShows: actualArrivals.filter((row) => row.status === 'NO_SHOW').length, cancellations: cancelledArrivals.length + cancelledDepartures.length, walkIns: actualArrivals.filter((row) => String(row.source) === 'WALK_IN').length, roomsSold: snapshot?.occupiedRooms ?? occupiedRooms },
      performance: { adr: round(adr), revpar: round(revpar), roomsAvailable: availableRooms, occupancy: round(occupancyPercentage) },
      revenue: { ...Object.fromEntries(Object.entries(revenue).map(([key, value]) => [key, round(value)])), total: round(revenue.net + revenue.taxes), departmentBreakdown: [...departments.values()].map((row) => ({ ...row, gross: round(row.gross), discounts: round(row.discounts), adjustments: round(row.adjustments), refunds: round(row.refunds), taxes: round(row.taxes), net: round(row.net) })).sort((a, b) => b.gross - a.gross), otherDetails: otherRevenueDetails, derivedReconciliation: { derivedGross: round(derived.gross), derivedNet: round(derived.net), snapshotGross: financial ? round(money(financial.grossRevenue)) : null, snapshotNet: financial ? round(money(financial.netRevenue)) : null, grossVariance: financial ? round(derived.gross - money(financial.grossRevenue)) : null, netVariance: financial ? round(derived.net - money(financial.netRevenue)) : null } },
      concessions: { complimentaryRoom: round(complimentaryRoom), complimentaryFood: round(complimentaryFood), complimentaryPos: round(complimentaryPos), guestAmenityCost: round(money(financial?.guestAmenityCost)), totalValue: round(complimentaryRoom + complimentaryFood + complimentaryPos + money(financial?.guestAmenityCost)) },
      cityLedger: { creditSales: round(cityLedgerSales), settlements: round(cityLedgerSettlements), closingBalance: round(cityLedgerBalance), creditBalance: round(cityLedgerCredits), corporateAdvanceCredits: round(corporateAdvanceCredits), unappliedCredit: round(unappliedCityLedgerCredit), orphanedFolioCount: orphanCityLedgerFolioCount, accountCount: corporateAccounts.length, unlinkedCorporateAccountCount: corporateAccountRegistry.filter((account) => !account.cityLedgerAccount).length, overLimitCount: corporateAccounts.filter((row) => row.overLimit).length, accounts: corporateAccounts },
      financial: { paymentTotals, cash: round(paymentByMethod(['CASH'])), card: round(paymentByMethod(['CARD', 'CARD_OFFLINE', 'POS'])), transfer: round(paymentByMethod(['BANK_TRANSFER', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'])), other: round(paymentByMethod(['CHEQUE', 'CITY_LEDGER', 'COMPLIMENTARY', 'OTHER'])), deposits: round(paymentByMethod(['CASH', 'CARD', 'CARD_OFFLINE', 'POS', 'BANK_TRANSFER', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT', 'CHEQUE'])), refunds: round(revenue.refunds), adjustments: round(revenue.adjustments), outstanding: round(outstandingDue), creditBalance: round(guestCreditBalance), guestRefundLiability: round(guestRefundLiability), cashExpected: sessionCash.expected, cashDeclared: sessionCash.declared, cashVariance: sessionCash.variance, closeCashExpected: financial?.cashExpected == null ? null : money(financial.cashExpected), closeCashDeclared: financial?.cashDeclared == null ? null : money(financial.cashDeclared), closeCashVariance: financial?.cashVariance == null ? null : money(financial.cashVariance) },
      movements: {
        arrivals: snapshotMovements.length ? actualArrivals : actualArrivals.map(movementRow),
        departures: snapshotMovements.length ? actualDepartures : actualDepartures.map(movementRow),
        cancellations: snapshotMovements.length ? [...cancelledArrivals, ...cancelledDepartures] : [...cancelledArrivals, ...cancelledDepartures].map(movementRow),
      },
      controls: { ...controls, sessions, housekeeping: housekeepingTotals, serviceRequests: serviceRequests.map((row) => ({ status: row.status, count: row._count.id })) },
      labour: { scheduled: rosters.length, published: rosters.filter((row) => row.publicationStatus === 'PUBLISHED').length, attendanceRecords: attendance.length, present: attendance.filter((row) => ['PRESENT', 'LATE'].includes(row.status)).length, late: attendance.filter((row) => row.status === 'LATE').length, absent: attendance.filter((row) => row.status === 'ABSENT').length, workedHours: round(hours) },
      flat: { roomRevenue: round(revenue.room), fbRevenue: round(revenue.fb), otherRevenue: round(revenue.other), grossRevenue: round(revenue.gross), netRevenue: round(revenue.net), totalTaxes: round(revenue.taxes), totalDiscounts: round(revenue.discounts), occupancyPercentage: round(occupancyPercentage), adr: round(adr), revPar: round(revpar), arrivals: actualArrivals.length, departures: actualDepartures.length, noShows: actualArrivals.filter((row) => row.status === 'NO_SHOW').length, walkIns: actualArrivals.filter((row) => String(row.source) === 'WALK_IN').length },
    };
    return successResponse({ ...report, ...report.flat });
  } catch (err: any) {
    console.error('[Managers Flash GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message || 'Failed to build manager flash report', 500);
  }
}

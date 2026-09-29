import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds } = await requireOrganizationContext(session.user.id);
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const userRole = String((session.user as any).role || '').toUpperCase();
    const managementReadRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'DIRECTOR', 'MANAGER', 'HOTEL_MANAGER', 'GENERAL_MANAGER']);
    const canReadCorporateAnalytics = managementReadRoles.has(userRole) || await hasPermission(session.user.id, propertyId || '', 'corporate_account:view');
    if (!propertyId || !propertyIds.includes(propertyId) || !canReadCorporateAnalytics) {
      return errorResponse('FORBIDDEN', 'Missing required corporate account permission', 403);
    }

    const now = new Date();
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const [accounts, ledgerAccounts, reservations, folioTotals, openSharedFolios, checkedInGuests, trendReservations, trendRevenueItems, invoices, paymentEntries, pendingRefundRequests, openGuestCreditEntries] = await Promise.all([
      prisma.corporateAccount.findMany({
        where: { propertyId },
        include: { cityLedgerAccount: { select: { id: true, balance: true, currency: true } }, ratePlan: { select: { id: true, name: true, code: true, isActive: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.cityLedgerAccount.findMany({
        where: { propertyId, status: 'ACTIVE' },
        select: { id: true, name: true, type: true, status: true, balance: true, currency: true },
        orderBy: { name: 'asc' },
      }),
      prisma.reservation.groupBy({
        by: ['corporateAccountId'],
        where: { propertyId, corporateAccountId: { not: null }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        _count: { _all: true },
      }),
      prisma.folio.groupBy({
        by: ['corporateAccountId'],
        where: { propertyId, corporateAccountId: { not: null }, status: { not: 'VOID' } },
        _sum: { totalCharges: true, totalPayments: true, balance: true },
      }),
      prisma.folio.groupBy({
        by: ['corporateAccountId'],
        where: { propertyId, corporateAccountId: { not: null }, status: 'OPEN', type: 'CITY_LEDGER' },
        _count: { _all: true },
      }),
      prisma.reservation.groupBy({
        by: ['corporateAccountId'],
        where: { propertyId, corporateAccountId: { not: null }, status: 'CHECKED_IN' },
        _count: { _all: true },
      }),
      prisma.reservation.findMany({
        where: { propertyId, corporateAccountId: { not: null }, checkIn: { gte: trendStart }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        select: { corporateAccountId: true, checkIn: true },
        orderBy: { checkIn: 'asc' },
      }),
      prisma.folioItem.findMany({
        where: { folio: { propertyId, corporateAccountId: { not: null } }, businessDate: { gte: trendStart }, type: 'CHARGE', voidedAt: null },
        select: { businessDate: true, amount: true },
      }),
      prisma.cityLedgerInvoice.findMany({
        where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
        select: { id: true, accountId: true, invoiceNumber: true, issueDate: true, dueDate: true, outstandingAmount: true, currency: true, status: true, account: { select: { name: true, type: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.cityLedgerEntry.findMany({
        where: { propertyId, type: 'PAYMENT', status: { not: 'REVERSED' }, account: { type: 'CORPORATE' } },
        select: { accountId: true, amount: true, allocations: { select: { amount: true } } },
      }),
      prisma.refundRequest.findMany({
        where: { propertyId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] }, cityLedgerEntryId: { not: null } },
        select: { id: true, requestedAmount: true, approvedAmount: true, currency: true, status: true, cityLedgerEntry: { select: { accountId: true } } },
      }),
      prisma.cityLedgerEntry.findMany({
        where: { propertyId, type: 'REFUND_OWED', status: 'OPEN', account: { type: 'REFUND_PAYABLE', status: 'ACTIVE' } },
        select: { id: true, accountId: true, guestId: true, guest: { select: { firstName: true, lastName: true, email: true, phone: true } }, reservationId: true, amount: true, currency: true, createdAt: true, allocations: { select: { amount: true } }, refundRequests: { select: { id: true, requestedAmount: true, approvedAmount: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const corporateByLedger = new Map(accounts.filter(a => a.cityLedgerAccountId).map(a => [a.cityLedgerAccountId!, a]));
    const reservationCounts = new Map(reservations.map(r => [r.corporateAccountId!, r._count._all]));
    const folioByAccount = new Map(folioTotals.map(row => [row.corporateAccountId!, row._sum]));
    const openSharedFolioCounts = new Map(openSharedFolios.map(row => [row.corporateAccountId!, row._count._all]));
    const checkedInGuestCounts = new Map(checkedInGuests.map(row => [row.corporateAccountId!, row._count._all]));
    const accountByLedger = new Map(ledgerAccounts.map(account => [account.id, account]));
    const corporateInvoices = invoices.filter(invoice => accountByLedger.has(invoice.accountId));
    const unappliedAdvanceByLedger = new Map<string, number>();
    for (const payment of paymentEntries) {
      const unapplied = Math.max(0, Number(payment.amount) - payment.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0));
      if (unapplied > 0.01) unappliedAdvanceByLedger.set(payment.accountId, (unappliedAdvanceByLedger.get(payment.accountId) || 0) + unapplied);
    }
    const ageBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const invoice of corporateInvoices) {
      const age = Math.max(0, Math.floor((today.getTime() - new Date(invoice.dueDate).getTime()) / DAY));
      const amount = Number(invoice.outstandingAmount);
      if (age === 0) ageBuckets.current += amount;
      else if (age <= 30) ageBuckets.days1to30 += amount;
      else if (age <= 60) ageBuckets.days31to60 += amount;
      else if (age <= 90) ageBuckets.days61to90 += amount;
      else ageBuckets.over90 += amount;
    }

    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
    const monthMap = new Map<string, { month: string; bookings: number; revenue: number }>();
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const key = monthKey(date);
      monthMap.set(key, { month: monthLabel(key), bookings: 0, revenue: 0 });
    }
    for (const reservation of trendReservations) {
      const row = monthMap.get(monthKey(new Date(reservation.checkIn)));
      if (row) row.bookings += 1;
    }
    for (const item of trendRevenueItems) {
      const row = monthMap.get(monthKey(new Date(item.businessDate)));
      if (row) row.revenue += Number(item.amount || 0);
    }

    const pendingRefundByAccount = new Map<string, number>();
    for (const request of pendingRefundRequests) {
      const accountId = request.cityLedgerEntry?.accountId;
      if (accountId) pendingRefundByAccount.set(accountId, (pendingRefundByAccount.get(accountId) || 0) + Number(request.approvedAmount || request.requestedAmount || 0));
    }
    const openGuestCreditByAccount = new Map<string, { amount: number; count: number }>();
    for (const entry of openGuestCreditEntries) {
      const remainingAmount = Math.max(0, Number(entry.amount || 0) - entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0));
      if (remainingAmount <= 0.01) continue;
      const current = openGuestCreditByAccount.get(entry.accountId) || { amount: 0, count: 0 };
      current.amount += remainingAmount;
      current.count += 1;
      openGuestCreditByAccount.set(entry.accountId, current);
    }
    const rows: Array<{
      id: string; ledgerAccountId: string | null; name: string; code: string; type: string; isActive: boolean;
      contactPerson: string | null; contactEmail: string | null; contactPhone: string | null; creditLimit: number;
      balance: number; receivable: number; liability: number; openGuestCreditAmount: number; openGuestCreditCount: number; advanceCredit: number; unappliedAdvanceCredit: number;
      pendingRefundAmount: number; availableCredit: number; utilization: number | null; depositPolicy: string | null;
      exemptFromHighBalance: boolean; ratePlanId: string | null; ratePlan: unknown; cityLedgerAccountId: string | null;
      currency: string; bookings: number; charges: number; payments: number; ratePlanLocked: boolean;
      openSharedFolios: number; checkedInGuests: number;
    }> = ledgerAccounts.map(ledger => {
      const account = corporateByLedger.get(ledger.id);
      const ledgerBalance = Number(ledger.balance || 0);
      const isRefundPayable = ledger.type === 'REFUND_PAYABLE';
      const receivable = isRefundPayable ? 0 : Math.max(0, ledgerBalance);
      const unappliedAdvanceCredit = ledger.type === 'CORPORATE' ? (unappliedAdvanceByLedger.get(ledger.id) || 0) : 0;
      const advanceCredit = ledger.type === 'CORPORATE' ? Math.max(0, -ledgerBalance, unappliedAdvanceCredit) : 0;
      const folio = account ? folioByAccount.get(account.id) : null;
      const bookings = account ? (reservationCounts.get(account.id) || 0) : 0;
      const openSharedFolioCount = account ? (openSharedFolioCounts.get(account.id) || 0) : 0;
      const checkedInGuestCount = account ? (checkedInGuestCounts.get(account.id) || 0) : 0;
      const creditLimit = Number(account?.creditLimit || 0);
      const utilization = creditLimit > 0 ? Math.round((receivable / creditLimit) * 100) : null;
      const openGuestCredit = openGuestCreditByAccount.get(ledger.id) || { amount: 0, count: 0 };
      return {
        id: account?.id || ledger.id, ledgerAccountId: ledger.id, name: account?.name || ledger.name, code: account?.code || ledger.type, type: ledger.type, isActive: ledger.status === 'ACTIVE',
        contactPerson: account?.contactPerson || null, contactEmail: account?.contactEmail || null, contactPhone: account?.contactPhone || null,
        creditLimit, balance: ledgerBalance, receivable, liability: isRefundPayable ? openGuestCredit.amount : 0, openGuestCreditAmount: openGuestCredit.amount, openGuestCreditCount: openGuestCredit.count, advanceCredit, unappliedAdvanceCredit,
        pendingRefundAmount: pendingRefundByAccount.get(ledger.id) || 0, availableCredit: Math.max(0, creditLimit - receivable + advanceCredit), utilization,
        depositPolicy: account?.depositPolicy || null, exemptFromHighBalance: account?.exemptFromHighBalance || false,
        ratePlanId: account?.ratePlanId || null, ratePlan: account?.ratePlan || null, cityLedgerAccountId: ledger.id, currency: ledger.currency || 'NGN',
        bookings, charges: Number(folio?.totalCharges || 0), payments: Number(folio?.totalPayments || 0),
        ratePlanLocked: openSharedFolioCount > 0 || checkedInGuestCount > 0,
        openSharedFolios: openSharedFolioCount, checkedInGuests: checkedInGuestCount,
      };
    });
    const corporateWithoutLedger = accounts.filter(account => !account.cityLedgerAccountId).map(account => ({
      id: account.id, ledgerAccountId: null, name: account.name, code: account.code, type: 'CORPORATE', isActive: account.isActive,
      contactPerson: account.contactPerson, contactEmail: account.contactEmail, contactPhone: account.contactPhone,
      creditLimit: Number(account.creditLimit || 0), balance: 0, receivable: 0, liability: 0, openGuestCreditAmount: 0, openGuestCreditCount: 0, advanceCredit: 0, unappliedAdvanceCredit: 0, pendingRefundAmount: 0,
      availableCredit: Number(account.creditLimit || 0), utilization: null, depositPolicy: account.depositPolicy, exemptFromHighBalance: account.exemptFromHighBalance,
      ratePlanId: account.ratePlanId, ratePlan: account.ratePlan, cityLedgerAccountId: null, currency: 'NGN', bookings: reservationCounts.get(account.id) || 0,
      charges: Number(folioByAccount.get(account.id)?.totalCharges || 0), payments: Number(folioByAccount.get(account.id)?.totalPayments || 0), ratePlanLocked: false, openSharedFolios: 0, checkedInGuests: 0,
    }));
    rows.push(...corporateWithoutLedger);
    const outstanding = rows.reduce((sum, row) => sum + row.receivable, 0);
    const advanceCredit = rows.reduce((sum, row) => sum + row.advanceCredit, 0);
    const creditExposure = rows.reduce((sum, row) => sum + row.creditLimit, 0);
    const skipperOutstanding = rows.filter(row => row.type === 'SKIPPER').reduce((sum, row) => sum + row.receivable, 0);
    const refundPayable = rows.filter(row => row.type === 'REFUND_PAYABLE').reduce((sum, row) => sum + row.liability, 0);
    const pendingRefundAmount = rows.reduce((sum, row) => sum + row.pendingRefundAmount, 0);
    const guestCreditOutstanding = rows.reduce((sum, row) => sum + row.openGuestCreditAmount, 0);
    const overdue = ageBuckets.days1to30 + ageBuckets.days31to60 + ageBuckets.days61to90 + ageBuckets.over90;
    const attention = [
      ...rows.filter(row => row.isActive && row.utilization !== null && row.utilization >= 80).map(row => ({ type: 'CREDIT', severity: row.utilization! >= 100 ? 'critical' : 'warning', title: `${row.name} is at ${row.utilization}% credit utilization`, detail: `${row.balance.toLocaleString()} outstanding against ${row.creditLimit.toLocaleString()} limit`, accountId: row.id })),
      ...rows.filter(row => row.isActive && !row.ratePlan).map(row => ({ type: 'RATE', severity: 'info', title: `${row.name} has no negotiated rate plan`, detail: 'Bookings will not receive a corporate rate automatically.', accountId: row.id })),
      ...(overdue > 0 ? [{ type: 'AR', severity: 'warning', title: 'Corporate receivables require collection follow-up', detail: `${overdue.toLocaleString()} is past due across open invoices.`, accountId: null }] : []),
    ].slice(0, 8);
    const recentActivity = corporateInvoices.slice(0, 8).map(invoice => ({
      id: invoice.id, accountName: invoice.account.name, invoiceNumber: invoice.invoiceNumber,
      accountType: invoice.account.type, dueDate: invoice.dueDate, amount: Number(invoice.outstandingAmount), currency: invoice.currency, status: invoice.status,
    }));
    const corporateRows = rows.filter(row => row.type === 'CORPORATE');
    const corporateInvoiceCount = corporateInvoices.filter(invoice => invoice.account.type === 'CORPORATE').length;

    return successResponse({
      generatedAt: now.toISOString(), period: { start: trendStart.toISOString(), end: now.toISOString() },
      overview: { totalAccounts: rows.length, activeAccounts: rows.filter(row => row.isActive).length, creditExposure, outstanding, advanceCredit, skipperOutstanding, refundPayable, pendingRefundAmount, guestCreditOutstanding, overdue, bookings: rows.reduce((sum, row) => sum + row.bookings, 0), invoices: corporateInvoices.length, corporate: { totalAccounts: corporateRows.length, activeAccounts: corporateRows.filter(row => row.isActive).length, creditExposure: corporateRows.reduce((sum, row) => sum + row.creditLimit, 0), outstanding: corporateRows.reduce((sum, row) => sum + row.receivable, 0), advanceCredit: corporateRows.reduce((sum, row) => sum + row.advanceCredit, 0), bookings: corporateRows.reduce((sum, row) => sum + row.bookings, 0), invoices: corporateInvoiceCount } },
      accounts: rows.sort((a, b) => b.receivable - a.receivable),
      trend: Array.from(monthMap.values()),
      aging: Object.entries(ageBuckets).map(([bucket, amount]) => ({ bucket, amount })),
      topAccounts: [...rows].sort((a, b) => b.receivable - a.receivable).slice(0, 6),
      attention, recentActivity,
      pendingRefunds: pendingRefundRequests.map(request => ({ id: request.id, accountId: request.cityLedgerEntry?.accountId, accountName: request.cityLedgerEntry?.accountId ? accountByLedger.get(request.cityLedgerEntry.accountId)?.name || request.cityLedgerEntry.accountId : 'Unassigned refund', amount: Number(request.approvedAmount || request.requestedAmount || 0), currency: request.currency, status: request.status })),
      guestCredits: openGuestCreditEntries.map(entry => ({ id: entry.id, accountId: entry.accountId, accountName: accountByLedger.get(entry.accountId)?.name || entry.accountId, guestId: entry.guestId, guestName: entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}`.trim() : 'Unassigned guest', guestEmail: entry.guest?.email || null, guestPhone: entry.guest?.phone || null, reservationId: entry.reservationId, amount: Math.max(0, Number(entry.amount || 0) - entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)), currency: entry.currency, createdAt: entry.createdAt, refundRequests: entry.refundRequests.map(request => ({ id: request.id, requestedAmount: Number(request.requestedAmount || 0), approvedAmount: request.approvedAmount == null ? null : Number(request.approvedAmount), status: request.status })) })).filter(entry => entry.amount > 0.01),
    });
  } catch (error) {
    console.error('[corporate-accounts/analytics]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load corporate management analytics', 500);
  }
}

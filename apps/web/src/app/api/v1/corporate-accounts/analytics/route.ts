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
    if (!propertyId || !propertyIds.includes(propertyId) || !(await hasPermission(session.user.id, propertyId, 'corporate_account:view'))) {
      return errorResponse('FORBIDDEN', 'Missing required corporate account permission', 403);
    }

    const now = new Date();
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const [accounts, reservations, folioTotals, trendReservations, trendRevenueItems, invoices] = await Promise.all([
      prisma.corporateAccount.findMany({
        where: { propertyId },
        include: { cityLedgerAccount: { select: { id: true, balance: true, currency: true } }, ratePlan: { select: { id: true, name: true, code: true, isActive: true } } },
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
    ]);

    const accountByLedger = new Map(accounts.filter(a => a.cityLedgerAccountId).map(a => [a.cityLedgerAccountId!, a]));
    const reservationCounts = new Map(reservations.map(r => [r.corporateAccountId!, r._count._all]));
    const folioByAccount = new Map(folioTotals.map(row => [row.corporateAccountId!, row._sum]));
    const corporateInvoices = invoices.filter(invoice => accountByLedger.has(invoice.accountId));
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

    const rows = accounts.map(account => {
      const ledgerBalance = Number(account.cityLedgerAccount?.balance || 0);
      const folio = folioByAccount.get(account.id);
      const bookings = reservationCounts.get(account.id) || 0;
      const creditLimit = Number(account.creditLimit || 0);
      const utilization = creditLimit > 0 ? Math.round((ledgerBalance / creditLimit) * 100) : null;
      return {
        id: account.id, name: account.name, code: account.code, isActive: account.isActive,
        contactPerson: account.contactPerson, contactEmail: account.contactEmail, contactPhone: account.contactPhone,
        creditLimit, balance: ledgerBalance, availableCredit: Math.max(0, creditLimit - ledgerBalance), utilization,
        depositPolicy: account.depositPolicy, exemptFromHighBalance: account.exemptFromHighBalance,
        ratePlan: account.ratePlan, cityLedgerAccountId: account.cityLedgerAccountId, currency: account.cityLedgerAccount?.currency || 'NGN',
        bookings, charges: Number(folio?.totalCharges || 0), payments: Number(folio?.totalPayments || 0),
      };
    });
    const outstanding = rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
    const creditExposure = rows.reduce((sum, row) => sum + row.creditLimit, 0);
    const overdue = ageBuckets.days1to30 + ageBuckets.days31to60 + ageBuckets.days61to90 + ageBuckets.over90;
    const attention = [
      ...rows.filter(row => row.isActive && row.utilization !== null && row.utilization >= 80).map(row => ({ type: 'CREDIT', severity: row.utilization! >= 100 ? 'critical' : 'warning', title: `${row.name} is at ${row.utilization}% credit utilization`, detail: `${row.balance.toLocaleString()} outstanding against ${row.creditLimit.toLocaleString()} limit`, accountId: row.id })),
      ...rows.filter(row => row.isActive && !row.ratePlan).map(row => ({ type: 'RATE', severity: 'info', title: `${row.name} has no negotiated rate plan`, detail: 'Bookings will not receive a corporate rate automatically.', accountId: row.id })),
      ...(overdue > 0 ? [{ type: 'AR', severity: 'warning', title: 'Corporate receivables require collection follow-up', detail: `${overdue.toLocaleString()} is past due across open invoices.`, accountId: null }] : []),
    ].slice(0, 8);
    const recentActivity = corporateInvoices.slice(0, 8).map(invoice => ({
      id: invoice.id, accountName: invoice.account.name, invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate, amount: Number(invoice.outstandingAmount), currency: invoice.currency, status: invoice.status,
    }));

    return successResponse({
      generatedAt: now.toISOString(), period: { start: trendStart.toISOString(), end: now.toISOString() },
      overview: { totalAccounts: rows.length, activeAccounts: rows.filter(row => row.isActive).length, creditExposure, outstanding, overdue, bookings: rows.reduce((sum, row) => sum + row.bookings, 0), invoices: corporateInvoices.length },
      accounts: rows.sort((a, b) => b.balance - a.balance),
      trend: Array.from(monthMap.values()),
      aging: Object.entries(ageBuckets).map(([bucket, amount]) => ({ bucket, amount })),
      topAccounts: [...rows].sort((a, b) => b.charges - a.charges).slice(0, 6),
      attention, recentActivity,
    });
  } catch (error) {
    console.error('[corporate-accounts/analytics]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load corporate management analytics', 500);
  }
}

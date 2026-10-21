import { prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { getPropertyBusinessDate, calculateDailyRevenue, getExecutiveRevenueTrend } from '../kpi';
import { addDays, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { TaxRemittanceService } from './tax-remittance-service';

export class AccountantAnalyticsService {
  /**
   * Retrieves all key performance indicators for the accountant overview dashboard.
   */
  static async getOverviewKPIs(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');

    const businessDate = await getPropertyBusinessDate(propertyId);
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { timezone: true } });
    if (!property) throw new Error('Property not found');
    const timezone = property.timezone || 'Africa/Lagos';
    const yesterday = subDays(businessDate, 1);

    // 1. Revenue today & yesterday (from kpi.ts)
    const [revenueToday, revenueYesterday] = await Promise.all([
      calculateDailyRevenue(propertyId, businessDate),
      calculateDailyRevenue(propertyId, yesterday)
    ]);

    // 2. Financial Position: Cash & Bank
    const cashAccounts = await prisma.cashAccount.findMany({
      where: { propertyId, type: { in: ['SAFE', 'BANK_ACCOUNT'] } }
    });
    const safeBalance = cashAccounts.filter(a => a.type === 'SAFE').reduce((sum, a) => sum + Number(a.balance), 0);
    const bankBalance = cashAccounts.filter(a => a.type === 'BANK_ACCOUNT').reduce((sum, a) => sum + Number(a.balance), 0);
    const totalCash = safeBalance + bankBalance;

    // 3. AR Outstanding (Guest Folios)
    const arGuests = await prisma.folio.aggregate({
      where: { propertyId, balance: { gt: 0 }, status: { not: 'CANCELLED' } },
      _sum: { balance: true }
    });

    // 4. City Ledger Outstanding
    const cityLedger = await prisma.cityLedgerAccount.aggregate({
      where: { propertyId, balance: { gt: 0 } },
      _sum: { balance: true }
    });
    const totalAR = Number(arGuests._sum.balance || 0) + Number(cityLedger._sum.balance || 0);

    // 5. AP Outstanding (Suppliers)
    const apOutstanding = await prisma.supplierInvoice.aggregate({
      where: { propertyId, status: { notIn: ['PAID', 'CANCELLED'] } },
      _sum: { outstandingAmount: true }
    });
    const overdueInvoices = await prisma.supplierInvoice.count({
      where: { propertyId, status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lt: new Date() } }
    });

    // 6. Tax Liability
    // We get the start of the current month and today as the period
    const startOfMonth = new Date(businessDate.getFullYear(), businessDate.getMonth(), 1);
    const currentTaxes = await TaxRemittanceService.getCollectedForPeriod(propertyId, startOfMonth, businessDate);
    
    // Get remitted taxes for the same period
    const remitted = await prisma.taxRemittance.aggregate({
      where: { propertyId, status: 'REMITTED', periodStart: { gte: startOfMonth }, periodEnd: { lte: businessDate } },
      _sum: { remittedAmount: true }
    });
    
    const taxLiability = currentTaxes.total - Number(remitted._sum.remittedAmount || 0);

    // 7. Action Center / Flags
    const [
      pendingHandovers, 
      pendingDeposits, 
      pendingExpenses, 
      pendingExceptions,
      overdueReceivables,
      glExceptions,
      reconciliationDifferences
    ] = await Promise.all([
      prisma.cashHandover.count({ where: { propertyId, status: 'PENDING' } }),
      prisma.bankDeposit.count({ where: { propertyId, status: 'DRAFT' } }),
      prisma.cashExpense.count({ where: { propertyId, status: 'PENDING_APPROVAL' } }),
      prisma.transactionException.count({ where: { OR: [{ payment: { propertyId } }, { posPayment: { order: { propertyId } } }], status: 'OPEN' } }),
      prisma.cityLedgerInvoice.count({ where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } } }),
      prisma.journalEntry.count({ where: { propertyId, status: 'DRAFT' } }),
      prisma.bankDeposit.count({ where: { propertyId, status: 'EXCEPTION' } })
    ]);

    // 8. Trends
    const revenueTrend = await getExecutiveRevenueTrend(propertyId, businessDate);
    
    // Cash flow trend (last 7 days)
    const cashFlowStart = subDays(businessDate, 7);
    const dayStart = fromZonedTime(`${cashFlowStart.toISOString().slice(0, 10)}T00:00:00`, timezone);
    const dayAfterBusinessDate = addDays(businessDate, 1);
    const rangeEnd = fromZonedTime(`${dayAfterBusinessDate.toISOString().slice(0, 10)}T00:00:00`, timezone);
    
    const [inflows, outflows, supplierPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { folio: { propertyId }, createdAt: { gte: dayStart, lt: rangeEnd }, status: 'COMPLETED' },
        select: { createdAt: true, amount: true }
      }),
      prisma.cashExpense.findMany({
        where: { propertyId, paidAt: { gte: dayStart, lt: rangeEnd }, status: 'PAID' },
        select: { paidAt: true, amount: true }
      }),
      prisma.supplierPayment.findMany({
        where: { propertyId, paymentDate: { gte: dayStart, lt: rangeEnd } },
        select: { paymentDate: true, amount: true }
      })
    ]);

    // Format cashflow
    const cashFlow = Array.from({ length: 8 }).map((_, i) => {
      const date = subDays(businessDate, 7 - i);
      const dateStr = toZonedTime(date, timezone).toISOString().split('T')[0];
      
      const dayIn = inflows.filter(x => toZonedTime(x.createdAt, timezone).toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      const expenseOut = outflows.filter(x => x.paidAt && toZonedTime(x.paidAt, timezone).toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      const supplierOut = supplierPayments.filter(x => toZonedTime(x.paymentDate, timezone).toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      
      return {
        date: dateStr,
        inflow: dayIn,
        outflow: expenseOut + supplierOut,
        net: dayIn - (expenseOut + supplierOut)
      };
    });

    // 9. Audit Status
    const lastAudit = await prisma.nightAudit.findFirst({
      where: { propertyId },
      orderBy: { businessDate: 'desc' }
    });

    return {
      businessDate: businessDate.toISOString(),
      revenue: {
        today: revenueToday,
        yesterday: revenueYesterday
      },
      balances: {
        cashTotal: totalCash,
        safe: safeBalance,
        bank: bankBalance,
        arTotal: totalAR,
        apOutstanding: Number(apOutstanding._sum.outstandingAmount || 0),
        taxLiability: {
          total: taxLiability,
          lastCalculationDate: lastAudit?.businessDate
        }
      },
      flags: {
        openExceptions: pendingExceptions,
        overdueReceivables,
        overdueInvoices,
        pendingExpenses,
        pendingDeposits,
        pendingHandovers,
        glExceptions,
        reconciliationDifferences
      },
      audit: {
        lastAuditDate: lastAudit?.businessDate,
        lastAuditStatus: lastAudit?.status
      },
      trends: {
        revenue: revenueTrend,
        cashFlow
      }
    };
  }
}

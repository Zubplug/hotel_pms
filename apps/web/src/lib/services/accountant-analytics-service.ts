import { prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { getPropertyBusinessDate, calculateDailyRevenue, getExecutiveRevenueTrend } from '../kpi';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { TaxRemittanceService } from './tax-remittance-service';

export class AccountantAnalyticsService {
  /**
   * Retrieves all key performance indicators for the accountant overview dashboard.
   */
  static async getOverviewKPIs(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');

    const businessDate = await getPropertyBusinessDate(propertyId);
    const yesterday = subDays(businessDate, 1);

    // 1. Revenue today & yesterday (from kpi.ts)
    const [revenueToday, revenueYesterday] = await Promise.all([
      calculateDailyRevenue(propertyId, businessDate),
      calculateDailyRevenue(propertyId, yesterday)
    ]);

    // 2. Safe balance
    const safeAccount = await prisma.cashAccount.findFirst({
      where: { propertyId, type: 'SAFE' }
    });
    const safeBalance = safeAccount ? Number(safeAccount.balance) : 0;

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

    // 7. Pending actions count
    const [pendingHandovers, pendingDeposits, pendingExpenses, pendingExceptions] = await Promise.all([
      prisma.cashHandover.count({ where: { propertyId, status: 'PENDING' } }),
      prisma.bankDeposit.count({ where: { propertyId, status: 'DRAFT' } }),
      prisma.cashExpense.count({ where: { propertyId, status: 'PENDING_APPROVAL' } }),
      prisma.transactionException.count({ where: { OR: [{ payment: { propertyId } }, { posPayment: { order: { propertyId } } }], status: 'OPEN' } })
    ]);

    // 8. Trends
    const revenueTrend = await getExecutiveRevenueTrend(propertyId, businessDate);
    
    // Cash flow trend (last 7 days)
    const cashFlowStart = subDays(businessDate, 7);
    
    const [inflows, outflows, supplierPayments] = await Promise.all([
      prisma.payment.groupBy({
        by: ['createdAt'],
        where: { folio: { propertyId }, createdAt: { gte: startOfDay(cashFlowStart), lte: endOfDay(businessDate) }, status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.cashExpense.groupBy({
        by: ['paidAt'],
        where: { propertyId, paidAt: { gte: startOfDay(cashFlowStart), lte: endOfDay(businessDate) }, status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.supplierPayment.groupBy({
        by: ['paymentDate'],
        where: { propertyId, paymentDate: { gte: startOfDay(cashFlowStart), lte: endOfDay(businessDate) } },
        _sum: { amount: true }
      })
    ]);

    // Format cashflow
    const cashFlow = Array.from({ length: 8 }).map((_, i) => {
      const date = subDays(businessDate, 7 - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayIn = inflows.filter(x => x.createdAt?.toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item._sum?.amount ?? 0), 0);
      const expenseOut = outflows.filter(x => x.paidAt?.toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item._sum?.amount ?? 0), 0);
      const supplierOut = supplierPayments.filter(x => x.paymentDate?.toISOString().split('T')[0] === dateStr).reduce((sum, item) => sum + Number(item._sum?.amount ?? 0), 0);
      
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
      revenue: {
        today: revenueToday,
        yesterday: revenueYesterday
      },
      balances: {
        safe: safeBalance,
        arTotal: totalAR,
        apOutstanding: Number(apOutstanding._sum.outstandingAmount || 0),
        taxLiability
      },
      flags: {
        overdueInvoices,
        pendingHandovers,
        pendingDeposits,
        pendingExpenses,
        pendingExceptions
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

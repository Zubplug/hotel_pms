import { endOfDay, startOfMonth, startOfQuarter, startOfYear, subDays } from 'date-fns';
import prisma from '@hotel-pms/db';
import { FinancialStatementService } from './financial-statement-service';
import { BudgetService } from './budget-service';
import { DailyAccountingService } from './daily-accounting-service';
import type { TenantContext } from '../organization-access';

const asNumber = (value: unknown) => Number(value || 0);

/**
 * Management-only composition layer. It deliberately reuses the accounting
 * services that post and reconcile the books; this endpoint only assembles
 * evidence for the GM workspace and never mutates financial records.
 */
export class GeneralManagerAccountingService {
  static async getCommandCenter(ctx: TenantContext, propertyId: string, range: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, baseCurrency: true, businessDate: true },
    });
    if (!property) throw new Error('Property not found');

    const businessDate = property.businessDate || new Date();
    const periodStart = range === 'week'
      ? subDays(businessDate, 6)
      : range === 'quarter'
        ? startOfQuarter(businessDate)
        : range === 'year'
          ? startOfYear(businessDate)
          : startOfMonth(businessDate);
    const fourteenDaysAgo = subDays(businessDate, 13);
    const dayEnd = endOfDay(businessDate);

    const [statements, periods, budgets, nightAudits, auditEvents, journals, deposits, invoiceAging, taxRemittances, reconciliation] = await Promise.all([
      Promise.all([
        FinancialStatementService.getProfitAndLoss(propertyId, periodStart, dayEnd),
        FinancialStatementService.getBalanceSheet(propertyId, dayEnd),
        FinancialStatementService.getTrialBalance(propertyId, dayEnd),
        FinancialStatementService.getCashFlowStatement(propertyId, periodStart, dayEnd),
        FinancialStatementService.getGLReconciliation(propertyId, dayEnd),
      ]),
      prisma.accountingPeriod.findMany({ where: { propertyId }, orderBy: { periodStart: 'desc' }, take: 8 }),
      prisma.budget.findMany({ where: { propertyId, status: { in: ['APPROVED', 'SUBMITTED'] } }, include: { lines: true }, orderBy: { periodStart: 'desc' }, take: 3 }),
      prisma.nightAudit.findMany({ where: { propertyId, businessDate: { gte: fourteenDaysAgo, lte: businessDate } }, select: { businessDate: true, status: true, completedAt: true, posUnresolvedVariances: true, posSessionsPending: true, closePackage: { select: { status: true, finalizedAt: true } } }, orderBy: { businessDate: 'asc' } }),
      prisma.auditLog.findMany({ where: { propertyId, createdAt: { gte: fourteenDaysAgo, lte: dayEnd } }, select: { id: true, action: true, resource: true, resourceId: true, createdAt: true, userEmail: true, userRole: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      Promise.all([
        prisma.journalEntry.count({ where: { propertyId, entryDate: { gte: periodStart, lte: dayEnd }, status: 'POSTED' } }),
        prisma.journalEntry.count({ where: { propertyId, status: 'DRAFT' } }),
        prisma.journalEntry.aggregate({ where: { propertyId, entryDate: { gte: periodStart, lte: dayEnd }, status: 'POSTED' }, _sum: { totalDebit: true, totalCredit: true } }),
      ]),
      prisma.bankDeposit.groupBy({ by: ['status'], where: { propertyId }, _count: { _all: true }, _sum: { expectedAmount: true, difference: true } }),
      prisma.cityLedgerInvoice.groupBy({ by: ['status'], where: { propertyId }, _count: { _all: true }, _sum: { outstandingAmount: true } }),
      prisma.taxRemittance.findMany({ where: { propertyId, periodStart: { lte: dayEnd }, periodEnd: { gte: periodStart } }, orderBy: { periodStart: 'asc' } }),
      Promise.all([
        DailyAccountingService.getBankDepositReconciliation(propertyId, businessDate),
        DailyAccountingService.getCashierSettlement(propertyId, businessDate),
      ]),
    ]);

    const [profitAndLoss, balanceSheet, trialBalance, cashFlow, glReconciliation] = statements;
    const currentBudget = budgets.find((budget) => budget.status === 'APPROVED') || budgets[0] || null;
    const budgetActuals = currentBudget ? await BudgetService.getActuals(propertyId, currentBudget.id) : null;
    const postedDebit = asNumber(journals[2]._sum.totalDebit);
    const postedCredit = asNumber(journals[2]._sum.totalCredit);
    const taxCollected = taxRemittances.reduce((sum, row) => sum + asNumber(row.collectedAmount), 0);
    const taxRemitted = taxRemittances.reduce((sum, row) => sum + asNumber(row.remittedAmount), 0);

    return {
      property,
      businessDate: businessDate.toISOString(),
      period: { range, start: periodStart.toISOString(), end: dayEnd.toISOString() },
      statements: { profitAndLoss, balanceSheet, trialBalance, cashFlow, glReconciliation },
      close: {
        periods,
        currentPeriod: periods.find((period) => period.status === 'OPEN') || periods[0] || null,
        nightAudits,
        latestNightAudit: nightAudits.at(-1) || null,
      },
      budget: currentBudget ? { ...currentBudget, actuals: budgetActuals } : null,
      controls: {
        journals: { posted: journals[0], drafts: journals[1], debit: postedDebit, credit: postedCredit, variance: postedDebit - postedCredit },
        deposits,
        cityLedgerInvoices: invoiceAging,
        tax: { collected: taxCollected, remitted: taxRemitted, liability: taxCollected - taxRemitted, remittances: taxRemittances },
        gl: glReconciliation.summary,
        reconciliation: { bankDeposits: reconciliation[0], cashierSettlement: reconciliation[1] },
      },
      auditEvents,
    };
  }
}

import { prisma } from '@hotel-pms/db';

export class DailyAccountingService {
  static async getBankDepositReconciliation(propertyId: string, businessDate: Date) {
    const deposits = await prisma.bankDeposit.findMany({ where: { propertyId, createdAt: { lte: new Date(businessDate.getTime() + 86400000) } }, include: { bankCashAccount: { select: { name: true, bankName: true, accountNumber: true } }, allocations: true }, orderBy: { createdAt: 'asc' } });
    const rows = deposits.map(deposit => ({ reference: deposit.depositReference, bankName: deposit.bankName || deposit.bankCashAccount?.bankName || 'Unassigned', bankAccount: deposit.bankAccount || deposit.bankCashAccount?.accountNumber || 'Unassigned', expected: Number(deposit.expectedAmount), declared: Number(deposit.declaredAmount || 0), confirmed: Number(deposit.bankConfirmedAmount || 0), difference: Number(deposit.difference || 0), status: deposit.status, shiftCount: deposit.allocations.length, depositDate: deposit.depositDate || deposit.createdAt }));
    return { rows, summary: { reference: 'TOTAL', bankName: '', bankAccount: '', expected: rows.reduce((sum, row) => sum + row.expected, 0), declared: rows.reduce((sum, row) => sum + row.declared, 0), confirmed: rows.reduce((sum, row) => sum + row.confirmed, 0), difference: rows.reduce((sum, row) => sum + row.difference, 0), status: '', shiftCount: rows.reduce((sum, row) => sum + row.shiftCount, 0), depositDate: null } };
  }

  static async getPettyCashLedger(propertyId: string, startDate: Date, endDate: Date) {
    const expenses = await prisma.cashExpense.findMany({ where: { propertyId, createdAt: { gte: startDate, lte: endDate } }, include: { cashAccount: { select: { name: true } } }, orderBy: { createdAt: 'asc' } });
    const rows = expenses.map(expense => ({ reference: expense.expenseReference, date: expense.createdAt, category: expense.category, payee: expense.payee, description: expense.description, amount: Number(expense.amount), status: expense.status, cashAccount: expense.cashAccount?.name || 'Unassigned' }));
    return { rows, summary: { reference: 'TOTAL', date: null, category: '', payee: '', description: '', amount: rows.reduce((sum, row) => sum + row.amount, 0), status: '', cashAccount: '' } };
  }

  static async getStockLedger(propertyId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.stockTransaction.findMany({ where: { propertyId, businessDate: { gte: startDate, lte: endDate } }, include: { stockItem: { select: { name: true, sku: true } } }, orderBy: { businessDate: 'asc' } });
    const rows = transactions.map(transaction => ({ date: transaction.businessDate, source: transaction.source, item: transaction.stockItem.name, sku: transaction.stockItem.sku || '', quantity: Number(transaction.quantity), unitCost: Number(transaction.unitCost), totalValue: Number(transaction.totalValue), reference: transaction.reference || '', reason: transaction.reason || '' }));
    return { rows, summary: { date: null, source: '', item: 'TOTAL', sku: '', quantity: rows.reduce((sum, row) => sum + row.quantity, 0), unitCost: 0, totalValue: rows.reduce((sum, row) => sum + row.totalValue, 0), reference: '', reason: '' } };
  }
  /**
   * Generates a Daily Revenue Report grouping revenue by Department and Outlet.
   * Strictly queries the GL, maintaining the canonical invariant.
   */
  static async getDailyRevenue(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        d.name as "departmentName",
        o.name as "outletName",
        c.code as "accountCode",
        c.name as "accountName",
        COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) as "netRevenue"
      FROM "JournalEntryLine" l
      JOIN "ChartOfAccount" c ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" = ${businessDate}
      LEFT JOIN "Department" d ON l."departmentId" = d.id
      LEFT JOIN "PosOutlet" o ON l."outletId" = o.id
      WHERE c."propertyId" = ${propertyId}::uuid AND c.type = 'REVENUE'
      GROUP BY d.name, o.name, c.code, c.name
      ORDER BY d.name ASC, o.name ASC, c.code ASC
    `;

    const rows = rawData.map(row => ({
      department: row.departmentName || 'General',
      outlet: row.outletName || 'N/A',
      accountCode: row.accountCode,
      accountName: row.accountName,
      netRevenue: Number(row.netRevenue)
    }));

    return {
      rows,
      summary: {
        department: '',
        outlet: '',
        accountCode: 'TOTAL',
        accountName: 'Total Daily Revenue',
        netRevenue: rows.reduce((s, r) => s + r.netRevenue, 0)
      }
    };
  }

  /**
   * Generates a Payment Method report by analyzing receipt accounts.
   */
  static async getPaymentMethodReport(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code as "accountCode",
        c.name as "accountName",
        c.category as "category",
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as "netCollected"
      FROM "JournalEntryLine" l
      JOIN "ChartOfAccount" c ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" = ${businessDate}
      WHERE c."propertyId" = ${propertyId}::uuid AND c.category IN ('Cash', 'Bank', 'Credit Card', 'Receivables')
      GROUP BY c.code, c.name, c.category
      ORDER BY c.category ASC, c.name ASC
    `;

    const rows = rawData.map(row => ({
      category: row.category,
      accountCode: row.accountCode,
      accountName: row.accountName,
      netCollected: Number(row.netCollected)
    }));

    return {
      rows,
      summary: {
        category: '',
        accountCode: 'TOTAL',
        accountName: 'Total Payments Collected',
        netCollected: rows.reduce((s, r) => s + r.netCollected, 0)
      }
    };
  }

  /**
   * Generates Cashier Settlement report linking Shifts to GL variances.
   */
  static async getCashierSettlement(propertyId: string, businessDate: Date) {
    const posShifts = await prisma.posSession.findMany({
      where: { propertyId, openedAt: { gte: businessDate, lte: new Date(businessDate.getTime() + 86400000) } },
      include: { primaryOperator: true, outlet: true }
    });

    const fdShifts = await prisma.frontdeskSession.findMany({
      where: { propertyId, openedAt: { gte: businessDate, lte: new Date(businessDate.getTime() + 86400000) } },
      include: { staff: true }
    });

    const rows = [
      ...posShifts.map(s => ({
        shiftId: s.id.substring(0, 8),
        cashier: s.primaryOperator ? `${s.primaryOperator.firstName} ${s.primaryOperator.lastName}`.trim() : 'Unassigned',
        location: s.outlet.name,
        expected: Number(s.expectedCash),
        declared: Number(s.actualCash || 0),
        variance: Number(s.variance || 0),
        status: s.controlStatus
      })),
      ...fdShifts.map(s => ({
        shiftId: s.id.substring(0, 8),
        cashier: `${s.staff.firstName} ${s.staff.lastName}`.trim(),
        location: 'Front Desk',
        expected: Number(s.systemExpectedCash),
        declared: Number(s.declaredCash || 0),
        variance: Number(s.variance || 0),
        status: s.controlStatus
      }))
    ];

    return {
      rows,
      summary: {
        shiftId: '',
        cashier: '',
        location: 'TOTALS',
        expected: rows.reduce((s, r) => s + r.expected, 0),
        declared: rows.reduce((s, r) => s + r.declared, 0),
        variance: rows.reduce((s, r) => s + r.variance, 0),
        status: ''
      }
    };
  }

  /**
   * Generates the Tax Report showing liabilities accrued today.
   */
  static async getTaxReport(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code as "accountCode",
        c.name as "accountName",
        COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) as "netAccrued"
      FROM "JournalEntryLine" l
      JOIN "ChartOfAccount" c ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" = ${businessDate}
      WHERE c."propertyId" = ${propertyId}::uuid AND c.category ILIKE '%tax%' AND c.type = 'LIABILITY'
      GROUP BY c.code, c.name
      ORDER BY c.code ASC
    `;

    const rows = rawData.map(row => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      netAccrued: Number(row.netAccrued)
    }));

    return {
      rows,
      summary: {
        accountCode: 'TOTAL',
        accountName: 'Total Tax Accrued',
        netAccrued: rows.reduce((s, r) => s + r.netAccrued, 0)
      }
    };
  }

  /**
   * Generates Discount & Complimentary report.
   */
  static async getDiscountComplimentary(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code as "accountCode",
        c.name as "accountName",
        c.category as "category",
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as "totalDiscount"
      FROM "JournalEntryLine" l
      JOIN "ChartOfAccount" c ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" = ${businessDate}
      WHERE c."propertyId" = ${propertyId}::uuid AND (c.name ILIKE '%discount%' OR c.name ILIKE '%complimentary%')
      GROUP BY c.code, c.name, c.category
      ORDER BY c.name ASC
    `;

    const rows = rawData.map(row => ({
      category: row.category,
      accountCode: row.accountCode,
      accountName: row.accountName,
      totalDiscount: Number(row.totalDiscount)
    }));

    return {
      rows,
      summary: {
        category: '',
        accountCode: 'TOTAL',
        accountName: 'Total Discounts/Comps',
        totalDiscount: rows.reduce((s, r) => s + r.totalDiscount, 0)
      }
    };
  }

  /**
   * Generates Void Report based on reversed journal entries.
   */
  static async getVoidReport(propertyId: string, businessDate: Date) {
    // Look for journal entries with status = 'REVERSED' or those that are reversals
    const entries = await prisma.journalEntry.findMany({
      where: {
        propertyId,
        entryDate: businessDate,
        OR: [
          { status: 'REVERSED' },
          { description: { contains: 'Reversal' } }
        ]
      },
      include: {
        lines: { include: { account: true } }
      }
    });

    const rows = entries.map(entry => {
      // Find the main revenue or AR line to quantify the void
      const mainLine = entry.lines.find(l => l.account.type === 'REVENUE') || entry.lines[0];
      return {
        entryNumber: entry.entryNumber,
        source: entry.source,
        description: entry.description,
        amount: Number(mainLine?.debit || 0) + Number(mainLine?.credit || 0),
        status: entry.status
      };
    });

    return {
      rows,
      summary: {
        entryNumber: 'TOTAL',
        source: '',
        description: 'Total Voided Amount',
        amount: rows.reduce((s, r) => s + r.amount, 0),
        status: ''
      }
    };
  }
}

import { prisma } from '@hotel-pms/db';
import { buildNightAuditBalanceProof } from '@/lib/night-audit-accounting';

export class FinancialStatementService {
  /**
   * Generates a Trial Balance as of a specific business date.
   */
  static async getTrialBalance(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.id as "accountId",
        c.code,
        c.name,
        c.type,
        c.category,
        COALESCE(SUM(l.debit), 0) as "sumDebit",
        COALESCE(SUM(l.credit), 0) as "sumCredit"
      FROM "ChartOfAccount" c
      LEFT JOIN ("JournalEntryLine" l INNER JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" <= ${businessDate}) ON l."accountId" = c.id
      WHERE c."propertyId" = ${propertyId}::uuid
      GROUP BY c.id, c.code, c.name, c.type, c.category
      ORDER BY c.code ASC
    `;

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = rawData.map(row => {
      const sumDebit = Number(row.sumDebit);
      const sumCredit = Number(row.sumCredit);

      let balance = 0;
      if (['ASSET', 'EXPENSE'].includes(row.type)) {
        balance = sumDebit - sumCredit;
      } else {
        balance = sumCredit - sumDebit;
      }

      const isDebitBalance = balance >= 0 ? ['ASSET', 'EXPENSE'].includes(row.type) : !['ASSET', 'EXPENSE'].includes(row.type);
      const absBalance = Math.abs(balance);

      const finalDebit = isDebitBalance ? absBalance : 0;
      const finalCredit = !isDebitBalance ? absBalance : 0;

      return {
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        debit: finalDebit,
        credit: finalCredit,
      };
    }).filter(row => row.debit > 0 || row.credit > 0); // Omit zero-balance accounts

    for (const row of rows) {
      totalDebit += row.debit;
      totalCredit += row.credit;
    }

    return {
      rows,
      summary: {
        code: 'TOTAL',
        name: 'TOTAL',
        type: '',
        category: '',
        debit: totalDebit,
        credit: totalCredit
      }
    };
  }

  /**
   * Generates a Profit & Loss Statement for a period.
   */
  static async getProfitAndLoss(propertyId: string, startDate: Date, endDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code,
        c.name,
        c.type,
        c.category,
        COALESCE(SUM(l.debit), 0) as "sumDebit",
        COALESCE(SUM(l.credit), 0) as "sumCredit"
      FROM "ChartOfAccount" c
      JOIN "JournalEntryLine" l ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" >= ${startDate} AND e."entryDate" <= ${endDate}
      WHERE c."propertyId" = ${propertyId}::uuid AND c.type IN ('REVENUE', 'EXPENSE')
      GROUP BY c.code, c.name, c.type, c.category
      ORDER BY c.type DESC, c.code ASC
    `;

    let totalRevenue = 0;
    let totalExpense = 0;

    const rows = rawData.map(row => {
      const sumDebit = Number(row.sumDebit);
      const sumCredit = Number(row.sumCredit);

      let balance = 0;
      if (row.type === 'REVENUE') {
        balance = sumCredit - sumDebit;
        totalRevenue += balance;
      } else {
        balance = sumDebit - sumCredit;
        totalExpense += balance;
      }

      return {
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        balance
      };
    });

    return {
      rows,
      summary: {
        code: 'NET',
        name: 'Net Profit / (Loss)',
        type: 'RESULT',
        category: '',
        balance: totalRevenue - totalExpense
      }
    };
  }

  /**
   * Generates a Balance Sheet as of a specific business date.
   */
  static async getBalanceSheet(propertyId: string, businessDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code,
        c.name,
        c.type,
        c.category,
        COALESCE(SUM(l.debit), 0) as "sumDebit",
        COALESCE(SUM(l.credit), 0) as "sumCredit"
      FROM "ChartOfAccount" c
      LEFT JOIN ("JournalEntryLine" l INNER JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" <= ${businessDate}) ON l."accountId" = c.id
      WHERE c."propertyId" = ${propertyId}::uuid AND c.type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
      GROUP BY c.code, c.name, c.type, c.category
      ORDER BY c.type ASC, c.code ASC
    `;

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let retainedEarnings = 0;

    const rows = rawData.map(row => {
      const sumDebit = Number(row.sumDebit);
      const sumCredit = Number(row.sumCredit);

      let balance = 0;
      if (row.type === 'ASSET' || row.type === 'EXPENSE') {
        balance = sumDebit - sumCredit;
      } else {
        balance = sumCredit - sumDebit;
      }

      if (row.type === 'ASSET') totalAssets += balance;
      else if (row.type === 'LIABILITY') totalLiabilities += balance;
      else if (row.type === 'EQUITY') totalEquity += balance;
      else if (row.type === 'REVENUE' || row.type === 'EXPENSE') retainedEarnings += (row.type === 'REVENUE' ? balance : -balance);

      return {
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        balance
      };
    }).filter(r => ['ASSET', 'LIABILITY', 'EQUITY'].includes(r.type) && r.balance !== 0);

    // Inject Retained Earnings (Current Year Earnings from P&L)
    if (retainedEarnings !== 0) {
      rows.push({
        code: 'RE-CURR',
        name: 'Current Year Earnings',
        type: 'EQUITY',
        category: 'Retained Earnings',
        balance: retainedEarnings
      });
      totalEquity += retainedEarnings;
    }

    return {
      rows,
      summary: {
        code: 'CHECK',
        name: 'Total Assets = Liabilities + Equity',
        type: 'RESULT',
        category: '',
        balance: totalAssets - (totalLiabilities + totalEquity) // Should be 0
      }
    };
  }

  /**
   * Generates a detailed Journal Register
   */
  static async getJournalRegister(propertyId: string, startDate: Date, endDate: Date) {
    const entries = await prisma.journalEntry.findMany({
      where: {
        propertyId,
        status: 'POSTED',
        entryDate: { gte: startDate, lte: endDate }
      },
      include: {
        lines: {
          include: { account: true }
        }
      },
      orderBy: { entryDate: 'asc' }
    });

    const rows = entries.flatMap(entry =>
      entry.lines.map(line => ({
        date: entry.entryDate,
        entryNumber: entry.entryNumber,
        source: entry.source,
        description: line.description || entry.description,
        accountCode: line.account.code,
        accountName: line.account.name,
        debit: Number(line.debit),
        credit: Number(line.credit)
      }))
    );

    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

    return {
      rows,
      summary: {
        date: null,
        entryNumber: '',
        source: '',
        description: 'TOTALS',
        accountCode: '',
        accountName: '',
        debit: totalDebit,
        credit: totalCredit
      }
    };
  }

  /**
   * Generates a basic Cash Flow Statement based on Cash/Bank account movements.
   */
  static async getCashFlowStatement(propertyId: string, startDate: Date, endDate: Date) {
    const rawData = await prisma.$queryRaw<any[]>`
      SELECT
        c.code,
        c.name,
        e.source as "activitySource",
        COALESCE(SUM(l.debit), 0) as "cashIn",
        COALESCE(SUM(l.credit), 0) as "cashOut"
      FROM "ChartOfAccount" c
      JOIN "JournalEntryLine" l ON l."accountId" = c.id
      JOIN "JournalEntry" e ON e.id = l."entryId" AND e.status = 'POSTED' AND e."entryDate" >= ${startDate} AND e."entryDate" <= ${endDate}
      WHERE c."propertyId" = ${propertyId}::uuid AND (c.category ILIKE '%cash%' OR c.category ILIKE '%bank%')
      GROUP BY c.code, c.name, e.source
      ORDER BY c.code ASC
    `;

    let netCashFlow = 0;

    const rows = rawData.map(row => {
      const cashIn = Number(row.cashIn);
      const cashOut = Number(row.cashOut);
      const netMovement = cashIn - cashOut; // Asset account, so debit is inflow, credit is outflow

      netCashFlow += netMovement;

      return {
        code: row.code,
        name: row.name,
        source: row.activitySource,
        cashIn,
        cashOut,
        netMovement
      };
    });

    return {
      rows,
      summary: {
        code: 'TOTAL',
        name: 'Net Cash Flow',
        source: '',
        cashIn: rows.reduce((s, r) => s + r.cashIn, 0),
        cashOut: rows.reduce((s, r) => s + r.cashOut, 0),
        netMovement: netCashFlow
      }
    };
  }

  /**
   * Reconciles GL balances against Subledger control accounts.
   */
  static async getGLReconciliation(propertyId: string, businessDate: Date) {
    const proof = await buildNightAuditBalanceProof(prisma, { propertyId, businessDate });
    const rows = proof.map(row => ({
      control: row.accountKey.replaceAll('_', ' '),
      glBalance: Number(row.actualClosing),
      subledgerBalance: Number(row.expectedClosing),
      variance: Number(row.variance),
      status: row.status === 'PROVEN' ? 'RECONCILED' : 'VARIANCE',
    }));
    return {
      rows,
      summary: {
        control: 'TOTAL VARIANCE',
        glBalance: rows.reduce((sum, row) => sum + row.glBalance, 0),
        subledgerBalance: rows.reduce((sum, row) => sum + row.subledgerBalance, 0),
        variance: rows.reduce((sum, row) => sum + row.variance, 0),
        status: ''
      }
    };
  }
}

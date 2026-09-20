import { prisma } from '@hotel-pms/db';

export class ReceivablesService {
  static async getARInvoiceLedger(propertyId: string, asOfDate: Date) {
    const invoices = await prisma.cityLedgerInvoice.findMany({
      where: { propertyId, issueDate: { lte: asOfDate } },
      include: { account: { select: { name: true, type: true } } },
      orderBy: { issueDate: 'asc' },
    });
    const rows = invoices.map(invoice => ({
      invoiceNumber: invoice.invoiceNumber,
      accountName: invoice.account.name,
      accountType: invoice.account.type,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      amount: Number(invoice.amount),
      paidAmount: Number(invoice.paidAmount),
      outstandingAmount: Number(invoice.outstandingAmount),
      status: invoice.status,
      currency: invoice.currency,
    }));
    return { rows, summary: { invoiceNumber: 'TOTAL', accountName: '', accountType: '', issueDate: null, dueDate: null, amount: rows.reduce((sum, row) => sum + row.amount, 0), paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0), outstandingAmount: rows.reduce((sum, row) => sum + row.outstandingAmount, 0), status: '', currency: '' } };
  }

  static async getSupplierAging(propertyId: string, asOfDate: Date) {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { propertyId, dueDate: { lte: asOfDate }, outstandingAmount: { gt: 0 } },
      include: { supplier: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });
    const rows = invoices.map(invoice => {
      const days = Math.max(0, Math.floor((asOfDate.getTime() - invoice.dueDate.getTime()) / 86400000));
      return { invoiceNumber: invoice.invoiceNumber, supplierName: invoice.supplier.name, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, totalAmount: Number(invoice.totalAmount), paidAmount: Number(invoice.paidAmount), outstandingAmount: Number(invoice.outstandingAmount), daysOutstanding: days, status: invoice.status, currency: invoice.currency };
    });
    return { rows, summary: { invoiceNumber: 'TOTAL', supplierName: '', invoiceDate: null, dueDate: null, totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0), paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0), outstandingAmount: rows.reduce((sum, row) => sum + row.outstandingAmount, 0), daysOutstanding: 0, status: '', currency: '' } };
  }

  static async getSupplierRemittance(propertyId: string, startDate: Date, endDate: Date) {
    const payments = await prisma.supplierPayment.findMany({ where: { propertyId, paymentDate: { gte: startDate, lte: endDate } }, include: { invoice: { include: { supplier: { select: { name: true } } } } }, orderBy: { paymentDate: 'asc' } });
    const rows = payments.map(payment => ({ paymentDate: payment.paymentDate, paymentReference: payment.paymentReference, invoiceNumber: payment.invoice.invoiceNumber, supplierName: payment.invoice.supplier.name, amount: Number(payment.amount), currency: payment.currency, paymentMethod: payment.paymentMethod, bankReference: payment.bankReference || '', journalEntryId: payment.journalEntryId || '' }));
    return { rows, summary: { paymentDate: null, paymentReference: 'TOTAL', invoiceNumber: '', supplierName: '', amount: rows.reduce((sum, row) => sum + row.amount, 0), currency: '', paymentMethod: '', bankReference: '', journalEntryId: '' } };
  }

  /**
   * Generates the AR Aging Summary report based on CityLedgerInvoices.
   * Groups outstanding balances by aging buckets (0-30, 31-60, 61-90, 90+ days).
   */
  static async getARAgingSummary(propertyId: string, asOfDate: Date) {
    const invoices = await prisma.cityLedgerInvoice.findMany({
      where: {
        propertyId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        issueDate: { lte: asOfDate }
      },
      include: { account: true }
    });

    const accountsMap = new Map<string, any>();

    for (const inv of invoices) {
      if (!accountsMap.has(inv.accountId)) {
        accountsMap.set(inv.accountId, {
          accountId: inv.accountId,
          accountName: inv.account.name,
          accountType: inv.account.type,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          days120Plus: 0,
          total: 0
        });
      }

      const acc = accountsMap.get(inv.accountId);
      const outstanding = Number(inv.outstandingAmount);

      const diffTime = asOfDate.getTime() - inv.dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) acc.current += outstanding;
      else if (diffDays <= 30) acc.days30 += outstanding;
      else if (diffDays <= 60) acc.days60 += outstanding;
      else if (diffDays <= 90) acc.days90 += outstanding;
      else acc.days120Plus += outstanding;

      acc.total += outstanding;
    }

    const rows = Array.from(accountsMap.values()).sort((a, b) => a.accountName.localeCompare(b.accountName));

    return {
      rows,
      summary: {
        accountId: '',
        accountName: 'TOTAL OUTSTANDING',
        accountType: '',
        current: rows.reduce((s, r) => s + r.current, 0),
        days30: rows.reduce((s, r) => s + r.days30, 0),
        days60: rows.reduce((s, r) => s + r.days60, 0),
        days90: rows.reduce((s, r) => s + r.days90, 0),
        days120Plus: rows.reduce((s, r) => s + r.days120Plus, 0),
        total: rows.reduce((s, r) => s + r.total, 0)
      }
    };
  }

  /**
   * Generates a Guest Ledger report containing all open Folios and their balances.
   */
  static async getGuestLedger(propertyId: string) {
    const folios = await prisma.folio.findMany({
      where: {
        propertyId,
        status: 'OPEN'
      },
      include: {
        reservation: { include: { guest: true } },
        guest: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const rows = folios.map(f => ({
      folioNumber: f.folioNumber,
      type: f.type,
      guestName: f.guest?.firstName ? `${f.guest.firstName} ${f.guest.lastName}` : (f.reservation?.guest?.firstName ? `${f.reservation.guest.firstName} ${f.reservation.guest.lastName}` : 'N/A'),
      room: f.reservation?.roomId ? 'Assigned' : 'N/A', // In a real app we'd join Room to get roomNumber
      totalCharges: Number(f.totalCharges),
      totalPayments: Number(f.totalPayments),
      balance: Number(f.balance)
    })).filter(r => r.balance !== 0);

    return {
      rows,
      summary: {
        folioNumber: 'TOTAL',
        type: '',
        guestName: 'Total Guest Ledger',
        room: '',
        totalCharges: rows.reduce((s, r) => s + r.totalCharges, 0),
        totalPayments: rows.reduce((s, r) => s + r.totalPayments, 0),
        balance: rows.reduce((s, r) => s + r.balance, 0)
      }
    };
  }

  /**
   * Generates a City Ledger Transfer report showing items moved to AR today.
   */
  static async getCityLedgerTransfers(propertyId: string, businessDate: Date) {
    const entries = await prisma.cityLedgerEntry.findMany({
      where: {
        propertyId,
        type: 'TRANSFER_IN',
        createdAt: {
          gte: businessDate,
          lt: new Date(businessDate.getTime() + 86400000)
        }
      },
      include: { account: true, folio: true }
    });

    const rows = entries.map(e => ({
      date: e.createdAt,
      accountName: e.account.name,
      folioNumber: e.folio?.folioNumber || 'Manual',
      reference: e.reference || '',
      reason: e.reason || '',
      amount: Number(e.amount)
    }));

    return {
      rows,
      summary: {
        date: null,
        accountName: 'TOTAL TRANSFERS',
        folioNumber: '',
        reference: '',
        reason: '',
        amount: rows.reduce((s, r) => s + r.amount, 0)
      }
    };
  }
}

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { FinancialStatementService } from '@/lib/services/financial-statement-service';
import { DailyAccountingService } from '@/lib/services/daily-accounting-service';
import { ReceivablesService } from '@/lib/services/receivables-service';
import { InventoryService } from '@/lib/services/inventory-service';
import { AuditService } from '@/lib/services/audit-service';
import { ReportViewer, ReportData } from '@/components/accountant/ReportViewer';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export default async function GenericReportViewerPage({ params, searchParams }: { params: Promise<{ reportId: string }>, searchParams: Promise<{ businessDate?: string, startDate?: string, endDate?: string }> }) {
  const [{ reportId }, query] = await Promise.all([params, searchParams]);
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freports');

  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = session.user.propertyId && propertyIds.includes(session.user.propertyId) ? session.user.propertyId : propertyIds[0];
  if (!propertyId) return <div>No property assigned</div>;

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } });

  const bDateStr = query.businessDate || property?.businessDate?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10);
  const businessDate = new Date(bDateStr);

  const sDateStr = query.startDate || new Date(businessDate.getFullYear(), businessDate.getMonth(), 1).toISOString().slice(0, 10);
  const startDate = new Date(sDateStr);
  const endDate = businessDate;

  let reportData: ReportData | null = null;
  const generatedAt = new Date();
  const generatedBy = session.user.name || session.user.email || 'System User';
  const filtersHash = Buffer.from(`${propertyId}-${bDateStr}-${sDateStr}`).toString('base64').substring(0, 12);
  const deterministicId = `${reportId.toUpperCase()}-${propertyId.slice(0, 8).toUpperCase()}-${bDateStr.replace(/-/g, '')}-${filtersHash}`;

  switch (reportId) {
    case 'trial-balance': {
      const tb = await FinancialStatementService.getTrialBalance(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Trial Balance',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'code', header: 'Account Code', align: 'left' },
          { key: 'name', header: 'Account Name', align: 'left' },
          { key: 'type', header: 'Type', align: 'left' },
          { key: 'debit', header: 'Debit', align: 'right', format: 'money' },
          { key: 'credit', header: 'Credit', align: 'right', format: 'money' }
        ],
        rows: tb.rows,
        summary: tb.summary
      };
      break;
    }
    case 'general-ledger': {
      const jr = await FinancialStatementService.getJournalRegister(propertyId, startDate, endDate);
      reportData = {
        id: deterministicId,
        title: 'General Ledger Transactions',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'date', header: 'Date', format: 'date' },
          { key: 'entryNumber', header: 'Journal ID' },
          { key: 'accountCode', header: 'Account' },
          { key: 'description', header: 'Description' },
          { key: 'debit', header: 'Debit', align: 'right', format: 'money' },
          { key: 'credit', header: 'Credit', align: 'right', format: 'money' }
        ],
        rows: jr.rows,
        summary: jr.summary
      };
      break;
    }
    case 'profit-and-loss': {
      const pl = await FinancialStatementService.getProfitAndLoss(propertyId, startDate, endDate);
      reportData = {
        id: deterministicId,
        title: 'Profit & Loss Statement',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Account Name' },
          { key: 'type', header: 'Type' },
          { key: 'balance', header: 'Net Balance', align: 'right', format: 'money' }
        ],
        rows: pl.rows,
        summary: pl.summary
      };
      break;
    }
    case 'balance-sheet': {
      const bs = await FinancialStatementService.getBalanceSheet(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Balance Sheet',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Account Name' },
          { key: 'type', header: 'Type' },
          { key: 'balance', header: 'Net Balance', align: 'right', format: 'money' }
        ],
        rows: bs.rows,
        summary: bs.summary
      };
      break;
    }
    case 'journal-register': {
      const jr = await FinancialStatementService.getJournalRegister(propertyId, startDate, endDate);
      reportData = {
        id: deterministicId,
        title: 'Journal Register',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'date', header: 'Date', format: 'date' },
          { key: 'entryNumber', header: 'Journal ID' },
          { key: 'accountCode', header: 'Account' },
          { key: 'description', header: 'Description' },
          { key: 'debit', header: 'Debit', align: 'right', format: 'money' },
          { key: 'credit', header: 'Credit', align: 'right', format: 'money' }
        ],
        rows: jr.rows,
        summary: jr.summary
      };
      break;
    }
    case 'cash-flow': {
      const cf = await FinancialStatementService.getCashFlowStatement(propertyId, startDate, endDate);
      reportData = {
        id: deterministicId,
        title: 'Cash Flow Statement',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Account Name' },
          { key: 'source', header: 'Activity Source' },
          { key: 'cashIn', header: 'Inflows', align: 'right', format: 'money' },
          { key: 'cashOut', header: 'Outflows', align: 'right', format: 'money' },
          { key: 'netMovement', header: 'Net Movement', align: 'right', format: 'money' }
        ],
        rows: cf.rows,
        summary: cf.summary
      };
      break;
    }
    case 'gl-reconciliation': {
      const recon = await FinancialStatementService.getGLReconciliation(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'GL to Subledger Reconciliation',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'control', header: 'Control Account' },
          { key: 'glBalance', header: 'GL Balance', align: 'right', format: 'money' },
          { key: 'subledgerBalance', header: 'Subledger Balance', align: 'right', format: 'money' },
          { key: 'variance', header: 'Variance', align: 'right', format: 'money' },
          { key: 'status', header: 'Status', align: 'center' }
        ],
        rows: recon.rows,
        summary: recon.summary
      };
      break;
    }
    case 'daily-revenue': {
      const rev = await DailyAccountingService.getDailyRevenue(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Daily Revenue Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'department', header: 'Department' },
          { key: 'outlet', header: 'Outlet' },
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Account Name' },
          { key: 'netRevenue', header: 'Net Revenue', align: 'right', format: 'money' }
        ],
        rows: rev.rows,
        summary: rev.summary
      };
      break;
    }
    case 'payment-methods': {
      const pay = await DailyAccountingService.getPaymentMethodReport(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Payment Method Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'category', header: 'Category' },
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Account Name' },
          { key: 'netCollected', header: 'Net Collected', align: 'right', format: 'money' }
        ],
        rows: pay.rows,
        summary: pay.summary
      };
      break;
    }
    case 'cashier-settlement': {
      const set = await DailyAccountingService.getCashierSettlement(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Cashier Settlement Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'shiftId', header: 'Shift ID' },
          { key: 'cashier', header: 'Cashier' },
          { key: 'location', header: 'Location' },
          { key: 'expected', header: 'Expected Cash', align: 'right', format: 'money' },
          { key: 'declared', header: 'Declared Cash', align: 'right', format: 'money' },
          { key: 'variance', header: 'Variance', align: 'right', format: 'money' },
          { key: 'status', header: 'Status' }
        ],
        rows: set.rows,
        summary: set.summary
      };
      break;
    }
    case 'tax-report': {
      const tax = await DailyAccountingService.getTaxReport(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Daily Tax Accrual Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Tax Account' },
          { key: 'netAccrued', header: 'Accrued Today', align: 'right', format: 'money' }
        ],
        rows: tax.rows,
        summary: tax.summary
      };
      break;
    }
    case 'discount-complimentary': {
      const dc = await DailyAccountingService.getDiscountComplimentary(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Discount & Complimentary Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'category', header: 'Category' },
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Account Name' },
          { key: 'totalDiscount', header: 'Total Value', align: 'right', format: 'money' }
        ],
        rows: dc.rows,
        summary: dc.summary
      };
      break;
    }
    case 'void-report': {
      const vr = await DailyAccountingService.getVoidReport(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Void & Reversal Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'entryNumber', header: 'Journal ID' },
          { key: 'source', header: 'Source' },
          { key: 'description', header: 'Reason / Description' },
          { key: 'status', header: 'Status' },
          { key: 'amount', header: 'Amount', align: 'right', format: 'money' }
        ],
        rows: vr.rows,
        summary: vr.summary
      };
      break;
    }
    case 'ar-aging': {
      const ar = await ReceivablesService.getARAgingSummary(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'AR Aging Summary',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'accountName', header: 'Account Name' },
          { key: 'accountType', header: 'Type' },
          { key: 'current', header: 'Current', align: 'right', format: 'money' },
          { key: 'days30', header: '1-30 Days', align: 'right', format: 'money' },
          { key: 'days60', header: '31-60 Days', align: 'right', format: 'money' },
          { key: 'days90', header: '61-90 Days', align: 'right', format: 'money' },
          { key: 'days120Plus', header: '90+ Days', align: 'right', format: 'money' },
          { key: 'total', header: 'Total Outstanding', align: 'right', format: 'money' }
        ],
        rows: ar.rows,
        summary: ar.summary
      };
      break;
    }
    case 'guest-ledger': {
      const gl = await ReceivablesService.getGuestLedger(propertyId);
      reportData = {
        id: deterministicId,
        title: 'Guest Ledger Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'folioNumber', header: 'Folio' },
          { key: 'type', header: 'Type' },
          { key: 'guestName', header: 'Guest Name' },
          { key: 'room', header: 'Room' },
          { key: 'totalCharges', header: 'Charges', align: 'right', format: 'money' },
          { key: 'totalPayments', header: 'Payments', align: 'right', format: 'money' },
          { key: 'balance', header: 'Balance', align: 'right', format: 'money' }
        ],
        rows: gl.rows,
        summary: gl.summary
      };
      break;
    }
    case 'city-ledger-transfer': {
      const cl = await ReceivablesService.getCityLedgerTransfers(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'City Ledger Transfers',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'date', header: 'Date', format: 'date' },
          { key: 'accountName', header: 'AR Account' },
          { key: 'folioNumber', header: 'Transferred From (Folio)' },
          { key: 'reference', header: 'Reference' },
          { key: 'reason', header: 'Notes' },
          { key: 'amount', header: 'Amount', align: 'right', format: 'money' }
        ],
        rows: cl.rows,
        summary: cl.summary
      };
      break;
    }
    case 'inventory-valuation': {
      const inv = await InventoryService.getInventoryValuation(propertyId);
      reportData = {
        id: deterministicId,
        title: 'Inventory Valuation Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'department', header: 'Department' },
          { key: 'category', header: 'Category' },
          { key: 'sku', header: 'SKU' },
          { key: 'name', header: 'Item Name' },
          { key: 'quantity', header: 'Qty on Hand', align: 'right' },
          { key: 'unitCost', header: 'Unit Cost', align: 'right', format: 'money' },
          { key: 'totalValue', header: 'Total Value', align: 'right', format: 'money' }
        ],
        rows: inv.rows,
        summary: inv.summary
      };
      break;
    }
    case 'cost-of-sales': {
      const cos = await InventoryService.getCostOfSales(propertyId, startDate, endDate);
      reportData = {
        id: deterministicId,
        title: 'Cost of Sales Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'department', header: 'Department' },
          { key: 'category', header: 'Category' },
          { key: 'name', header: 'Item Name' },
          { key: 'usageQty', header: 'Usage Qty', align: 'right' },
          { key: 'wasteQty', header: 'Waste Qty', align: 'right' },
          { key: 'costOfSales', header: 'Cost of Sales', align: 'right', format: 'money' }
        ],
        rows: cos.rows,
        summary: cos.summary
      };
      break;
    }
    case 'accounting-exceptions': {
      const ex = await AuditService.getAccountingExceptions(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Accounting Exceptions Report',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'date', header: 'Date', format: 'date' },
          { key: 'exceptionId', header: 'Exception ID' },
          { key: 'type', header: 'Type' },
          { key: 'reference', header: 'Reference' },
          { key: 'severity', header: 'Severity' },
          { key: 'status', header: 'Status' },
          { key: 'description', header: 'Description' }
        ],
        rows: ex.rows,
        summary: ex.summary
      };
      break;
    }
    case 'night-audit': {
      const na = await AuditService.getNightAuditLog(propertyId, businessDate);
      reportData = {
        id: deterministicId,
        title: 'Night Audit Log',
        property: property?.name || 'Property',
        businessDate,
        generatedAt,
        generatedBy,
        filtersHash,
        columns: [
          { key: 'timestamp', header: 'Timestamp', format: 'date' },
          { key: 'runId', header: 'Run ID' },
          { key: 'stepName', header: 'Step' },
          { key: 'status', header: 'Status' },
          { key: 'durationMs', header: 'Duration (ms)', align: 'right' },
          { key: 'notes', header: 'Notes' },
          { key: 'user', header: 'Triggered By' }
        ],
        rows: na.rows,
        summary: na.summary
      };
      break;
    }
    case 'ar-invoice-ledger': {
      const result = await ReceivablesService.getARInvoiceLedger(propertyId, businessDate);
      reportData = { id: deterministicId, title: 'AR Invoice Ledger', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'invoiceNumber', header: 'Invoice' }, { key: 'accountName', header: 'Account' }, { key: 'issueDate', header: 'Issued', format: 'date' }, { key: 'dueDate', header: 'Due', format: 'date' }, { key: 'amount', header: 'Amount', align: 'right', format: 'money' }, { key: 'paidAmount', header: 'Paid', align: 'right', format: 'money' }, { key: 'outstandingAmount', header: 'Outstanding', align: 'right', format: 'money' }, { key: 'status', header: 'Status' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'supplier-aging': {
      const result = await ReceivablesService.getSupplierAging(propertyId, businessDate);
      reportData = { id: deterministicId, title: 'Supplier AP Aging', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'invoiceNumber', header: 'Invoice' }, { key: 'supplierName', header: 'Supplier' }, { key: 'invoiceDate', header: 'Invoice date', format: 'date' }, { key: 'dueDate', header: 'Due date', format: 'date' }, { key: 'outstandingAmount', header: 'Outstanding', align: 'right', format: 'money' }, { key: 'daysOutstanding', header: 'Days outstanding', align: 'right', format: 'number' }, { key: 'status', header: 'Status' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'supplier-remittance': {
      const result = await ReceivablesService.getSupplierRemittance(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Supplier Remittance Register', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'paymentDate', header: 'Payment date', format: 'date' }, { key: 'paymentReference', header: 'Payment reference' }, { key: 'invoiceNumber', header: 'Invoice' }, { key: 'supplierName', header: 'Supplier' }, { key: 'amount', header: 'Amount', align: 'right', format: 'money' }, { key: 'paymentMethod', header: 'Method' }, { key: 'bankReference', header: 'Bank reference' }, { key: 'journalEntryId', header: 'Journal entry' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'bank-deposits': {
      const result = await DailyAccountingService.getBankDepositReconciliation(propertyId, businessDate);
      reportData = { id: deterministicId, title: 'Bank Deposit Reconciliation', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'reference', header: 'Reference' }, { key: 'bankName', header: 'Bank' }, { key: 'bankAccount', header: 'Account' }, { key: 'expected', header: 'Expected', align: 'right', format: 'money' }, { key: 'declared', header: 'Declared', align: 'right', format: 'money' }, { key: 'confirmed', header: 'Confirmed', align: 'right', format: 'money' }, { key: 'difference', header: 'Difference', align: 'right', format: 'money' }, { key: 'status', header: 'Status' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'petty-cash': {
      const result = await DailyAccountingService.getPettyCashLedger(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Petty Cash Ledger', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'reference', header: 'Reference' }, { key: 'date', header: 'Date', format: 'date' }, { key: 'category', header: 'Category' }, { key: 'payee', header: 'Payee' }, { key: 'description', header: 'Description' }, { key: 'amount', header: 'Amount', align: 'right', format: 'money' }, { key: 'status', header: 'Status' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'stock-ledger': {
      const result = await DailyAccountingService.getStockLedger(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Stock Ledger', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'date', header: 'Date', format: 'date' }, { key: 'source', header: 'Source' }, { key: 'item', header: 'Item' }, { key: 'sku', header: 'SKU' }, { key: 'quantity', header: 'Quantity', align: 'right', format: 'number' }, { key: 'unitCost', header: 'Unit cost', align: 'right', format: 'money' }, { key: 'totalValue', header: 'Total value', align: 'right', format: 'money' }, { key: 'reference', header: 'Reference' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'audit-trail': {
      const result = await AuditService.getAuditTrail(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Accounting Audit Trail', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'date', header: 'Date', format: 'date' }, { key: 'action', header: 'Action' }, { key: 'resource', header: 'Resource' }, { key: 'resourceId', header: 'Resource ID' }, { key: 'actor', header: 'Actor' }, { key: 'requestId', header: 'Request ID' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'manual-journals': {
      const result = await AuditService.getManualJournals(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Manual Journal Register', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'date', header: 'Date', format: 'date' }, { key: 'entryNumber', header: 'Entry' }, { key: 'description', header: 'Description' }, { key: 'status', header: 'Status' }, { key: 'debit', header: 'Debit', align: 'right', format: 'money' }, { key: 'credit', header: 'Credit', align: 'right', format: 'money' }, { key: 'postedBy', header: 'Posted by' }], rows: result.rows, summary: result.summary };
      break;
    }
    case 'backdated-transactions': {
      const result = await AuditService.getBackdatedTransactions(propertyId, startDate, endDate);
      reportData = { id: deterministicId, title: 'Backdated Transactions', property: property?.name || 'Property', businessDate, generatedAt, generatedBy, filtersHash, columns: [{ key: 'entryDate', header: 'Entry date', format: 'date' }, { key: 'createdAt', header: 'Created at', format: 'date' }, { key: 'entryNumber', header: 'Entry' }, { key: 'source', header: 'Source' }, { key: 'description', header: 'Description' }, { key: 'status', header: 'Status' }], rows: result.rows, summary: result.summary };
      break;
    }
    default:
      notFound();
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white">
      <ReportViewer data={reportData} currency={property?.baseCurrency || 'NGN'} />
    </div>
  );
}

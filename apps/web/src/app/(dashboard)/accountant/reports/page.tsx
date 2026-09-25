import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';
import { DailyAccountingService } from '@/lib/services/daily-accounting-service';
import { ReceivablesService } from '@/lib/services/receivables-service';
import { InventoryService } from '@/lib/services/inventory-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<{ businessDate?: string; startDate?: string; endDate?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freports');

  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = session.user.propertyId && propertyIds.includes(session.user.propertyId) ? session.user.propertyId : propertyIds[0];
  if (!propertyId) return <EmptyState title="No property assigned" />;

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } });
  const businessDate = resolvedSearchParams?.businessDate ? new Date(resolvedSearchParams.businessDate) : property?.businessDate || new Date();
  const [postedLines, cashierSettlement, arAging, inventoryValuation] = await Promise.all([
    prisma.journalEntryLine.findMany({ where: { entry: { propertyId, status: 'POSTED' } }, select: { debit: true, credit: true, account: { select: { category: true } } } }),
    DailyAccountingService.getCashierSettlement(propertyId, businessDate),
    ReceivablesService.getARAgingSummary(propertyId, businessDate),
    InventoryService.getInventoryValuation(propertyId),
  ]);

  const currency = property?.baseCurrency || 'NGN';
  const startDate = resolvedSearchParams?.startDate || new Date(Date.UTC(businessDate.getUTCFullYear(), businessDate.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const endDate = resolvedSearchParams?.endDate || businessDate.toISOString().slice(0, 10);
  const totalDebit = postedLines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = postedLines.reduce((sum, line) => sum + Number(line.credit), 0);
  const difference = Number((totalDebit - totalCredit).toFixed(2));
  const expectedCash = cashierSettlement.rows.reduce((sum, row) => sum + row.expected, 0);
  const declaredCash = cashierSettlement.rows.reduce((sum, row) => sum + row.declared, 0);
  const cashDifference = declaredCash - expectedCash;
  const arSubledger = arAging.summary.total;
  const arGl = postedLines.filter(line => String(line.account.category || '').toLowerCase().includes('receivable')).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
  const inventorySubledger = inventoryValuation.summary.totalValue;
  const inventoryGl = postedLines.filter(line => String(line.account.category || '').toLowerCase().includes('inventory')).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
  const controls = {
    gl: { status: difference === 0 ? 'RECONCILED' : 'VARIANCE', debit: totalDebit, credit: totalCredit, diff: difference },
    cash: { status: Math.abs(cashDifference) < 0.01 ? 'RECONCILED' : 'VARIANCE', expected: expectedCash, declared: declaredCash, diff: cashDifference },
    ar: { status: Math.abs(arSubledger - arGl) < 0.01 ? 'RECONCILED' : 'VARIANCE', subledger: arSubledger, gl: arGl, diff: arSubledger - arGl },
    inventory: { status: Math.abs(inventorySubledger - inventoryGl) < 0.01 ? 'RECONCILED' : 'VARIANCE', subledger: inventorySubledger, gl: inventoryGl, diff: inventorySubledger - inventoryGl }
  };
  const query = `?businessDate=${encodeURIComponent(businessDate.toISOString().slice(0, 10))}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  return (
    <main className="min-h-full bg-[#08111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
              <FileText className="h-4 w-4" />
              Accounting Reports
            </div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">The evidence behind every close.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Live presentation, reconciliation, and evidence layer sourced directly from the property ledger.
            </p>
          </div>
        </header>

        <form method="get" className="rounded-xl border border-white/10 bg-[#111a2b]/75 p-4 flex flex-wrap gap-4 items-end text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <label className="flex flex-col gap-1">Business date<input name="businessDate" type="date" defaultValue={businessDate.toISOString().slice(0, 10)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200" /></label>
          </div>
          <label className="flex flex-col gap-1 text-slate-400">From<input name="startDate" type="date" defaultValue={startDate} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200" /></label>
          <label className="flex flex-col gap-1 text-slate-400">To<input name="endDate" type="date" defaultValue={endDate} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200" /></label>
          <div className="flex flex-col gap-1 text-slate-400"><span>Property</span><strong className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200">{property?.name}</strong></div>
          <button type="submit" className="rounded-lg bg-cyan-500/20 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-500/30">Apply filters</button>
        </form>

        {/* Accounting Control Center */}
        <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,.1)] sm:p-6">
          <div className="mb-5 flex justify-between items-center">
            <h2 className="font-semibold text-white uppercase tracking-widest text-xs">Accounting Control Center</h2>
            <div className="flex gap-3">
              <Link href={`/accountant/reports/package/daily${query}`} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors">
                Daily Close Package
              </Link>
              <Link href={`/accountant/reports/package/monthly${query}`} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                Month-End Close Package
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ControlCard title="GL" status={controls.gl.status} items={[['Debit', money(controls.gl.debit, currency)], ['Credit', money(controls.gl.credit, currency)], ['Difference', money(controls.gl.diff, currency)]]} />
            <ControlCard title="Cash" status={controls.cash.status} items={[['Expected', money(controls.cash.expected, currency)], ['Declared', money(controls.cash.declared, currency)], ['Difference', money(controls.cash.diff, currency)]]} />
            <ControlCard title="AR" status={controls.ar.status} items={[['Subledger', money(controls.ar.subledger, currency)], ['GL', money(controls.ar.gl, currency)], ['Difference', money(controls.ar.diff, currency)]]} />
            <ControlCard title="Inventory" status={controls.inventory.status} items={[['Subledger', money(controls.inventory.subledger, currency)], ['GL', money(controls.inventory.gl, currency)], ['Difference', money(controls.inventory.diff, currency)]]} />
          </div>
        </section>

        {/* Grid Categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CategoryPanel title="Financial Statements">
            <ReportLink name="Trial Balance" href={`/accountant/reports/viewer/trial-balance${query}`} />
            <ReportLink name="General Ledger" href={`/accountant/reports/viewer/general-ledger${query}`} />
            <ReportLink name="Journal Register" href={`/accountant/reports/viewer/journal-register${query}`} />
            <ReportLink name="Profit & Loss" href={`/accountant/reports/viewer/profit-and-loss${query}`} />
            <ReportLink name="Balance Sheet" href={`/accountant/reports/viewer/balance-sheet${query}`} />
            <ReportLink name="Cash Flow" href={`/accountant/reports/viewer/cash-flow${query}`} />
          </CategoryPanel>

          <CategoryPanel title="Revenue & USALI">
            <ReportLink name="Daily Revenue" href={`/accountant/reports/viewer/daily-revenue${query}`} />
            <ReportLink name="Departmental Revenue" href={`/accountant/reports/viewer/daily-revenue${query}`} />
            <ReportLink name="Outlet Revenue" href={`/accountant/reports/viewer/daily-revenue${query}`} />
            <ReportLink name="Discount & Complimentary" href={`/accountant/reports/viewer/discount-complimentary${query}`} />
            <ReportLink name="Void Report" href={`/accountant/reports/viewer/void-report${query}`} />
            <ReportLink name="Tax Report" href={`/accountant/reports/viewer/tax-report${query}`} />
          </CategoryPanel>

          <CategoryPanel title="Receivables & Payables">
            <ReportLink name="AR Aging Summary" href={`/accountant/reports/viewer/ar-aging${query}`} />
            <ReportLink name="AR Invoice Ledger" href={`/accountant/reports/viewer/ar-invoice-ledger${query}`} />
            <ReportLink name="City Ledger Transfer" href={`/accountant/reports/viewer/city-ledger-transfer${query}`} />
            <ReportLink name="Guest Ledger" href={`/accountant/reports/viewer/guest-ledger${query}`} />
            <ReportLink name="AP Aging (Supplier)" href={`/accountant/reports/viewer/supplier-aging${query}`} />
            <ReportLink name="Supplier Remittance" href={`/accountant/reports/viewer/supplier-remittance${query}`} />
          </CategoryPanel>

          <CategoryPanel title="Cash & Banking">
            <ReportLink name="Payment Method Report" href={`/accountant/reports/viewer/payment-methods${query}`} />
            <ReportLink name="Cashier Settlement" href={`/accountant/reports/viewer/cashier-settlement${query}`} />
            <ReportLink name="Cash Over/Short" href={`/accountant/reports/viewer/cashier-settlement${query}`} />
            <ReportLink name="Bank Deposit Reconciliation" href={`/accountant/reports/viewer/bank-deposits${query}`} />
            <ReportLink name="Petty Cash Ledger" href={`/accountant/reports/viewer/petty-cash${query}`} />
          </CategoryPanel>

          <CategoryPanel title="F&B & Inventory">
            <ReportLink name="F&B Revenue" href={`/accountant/reports/viewer/daily-revenue${query}`} />
            <ReportLink name="Food Cost" href={`/accountant/reports/viewer/cost-of-sales${query}`} />
            <ReportLink name="Beverage Cost" href={`/accountant/reports/viewer/cost-of-sales${query}`} />
            <ReportLink name="Inventory Valuation" href={`/accountant/reports/viewer/inventory-valuation${query}`} />
            <ReportLink name="Cost of Sales" href={`/accountant/reports/viewer/cost-of-sales${query}`} />
            <ReportLink name="Stock Ledger" href={`/accountant/reports/viewer/stock-ledger${query}`} />
            <ReportLink name="Waste" href={`/accountant/reports/viewer/stock-ledger${query}`} />
          </CategoryPanel>

          <CategoryPanel title="Audit & Control">
            <ReportLink name="Accounting Exceptions" href={`/accountant/reports/viewer/accounting-exceptions${query}`} />
            <ReportLink name="GL/Subledger Reconciliation" href={`/accountant/reports/viewer/gl-reconciliation${query}`} />
            <ReportLink name="Audit Trail" href={`/accountant/reports/viewer/audit-trail${query}`} />
            <ReportLink name="Manual Journals" href={`/accountant/reports/viewer/manual-journals${query}`} />
            <ReportLink name="Adjustments" href={`/accountant/reports/viewer/manual-journals${query}`} />
            <ReportLink name="Backdated Transactions" href={`/accountant/reports/viewer/backdated-transactions${query}`} />
            <ReportLink name="Night Audit" href={`/accountant/reports/viewer/night-audit${query}`} />
          </CategoryPanel>
        </div>
      </div>
    </main>
  );
}

function ControlCard({ title, status, items }: { title: string, status: string, items: string[][] }) {
  const isOk = status === 'RECONCILED';
  const isErr = status === 'VARIANCE' || status === 'ERROR';

  return (
    <div className={`rounded-xl border p-4 transition-colors hover:bg-white/[.03] ${isOk ? 'border-emerald-500/20 bg-emerald-500/5' : isErr ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-500/20 bg-slate-500/5'}`}>
      <div className="flex justify-between items-center mb-3">
        <strong className="text-white">{title}</strong>
        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-full ${isOk ? 'bg-emerald-500/20 text-emerald-300' : isErr ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'}`}>
          {status}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-slate-400">
            <span>{label}</span>
            <span className="font-mono text-slate-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,.1)]">
      <h3 className="font-semibold text-white mb-4 uppercase text-xs tracking-widest text-slate-400 border-b border-white/10 pb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function ReportLink({ name, hint, href }: { name: string, hint?: string, href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between group rounded p-2 hover:bg-white/[.03] transition-colors cursor-pointer">
      <div>
        <div className="text-sm font-medium text-slate-300 group-hover:text-cyan-300 transition-colors">{name}</div>
        {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded">View</span>
      </div>
    </Link>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-[#08111f] text-slate-300">
      <div className="text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-slate-600" />
        <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';
import { ExpenseWorkspace } from '@/app/(cash-management)/expenses/expense-workspace';
import { RecordSupplierBillModal } from '@/components/accountant/RecordSupplierBillModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value);

const dateLabel = (value: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value);
const dayKey = (value: Date) => value.toISOString().slice(0, 10);
const startOfMonth = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
const endOfMonth = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 23, 59, 59, 999));

type Tone = 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';

export default async function AccountantExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fexpenses');

  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  if (!propertyIds.length) return <EmptyState title="No property assigned" />;

  // The dashboard is intentionally property-scoped. The operational workspace
  // supports one selected property; use the first authorized property here.
  const propertyId = propertyIds[0];
  const [property, cashExpenses, supplierInvoices, budgets, categories, costCenters, suppliers, cashAccounts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } }),
    prisma.cashExpense.findMany({
      where: { propertyId },
      include: { journal: true, cashAccount: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.supplierInvoice.findMany({
      where: { propertyId },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    prisma.budget.findMany({
      where: { propertyId, status: { in: ['ACTIVE', 'APPROVED'] } },
      include: { lines: true },
      orderBy: { periodStart: 'desc' },
      take: 12,
    }),
    prisma.expenseCategory.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.costCenter.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.cashAccount.findMany({ where: { propertyId, isActive: true, type: 'SAFE' }, select: { id: true, name: true, balance: true, glAccount: { select: { code: true, name: true } } } }),
  ]);

  const currency = property?.baseCurrency || cashExpenses[0]?.currency || 'NGN';
  const businessDate = property?.businessDate || new Date();
  const monthStart = startOfMonth(businessDate);
  const monthEnd = endOfMonth(businessDate);
  const isInMonth = (value: Date | null | undefined) => Boolean(value && value >= monthStart && value <= monthEnd);
  const openCash = cashExpenses.filter(item => ['PENDING_APPROVAL', 'APPROVED'].includes(item.status));
  const paidCash = cashExpenses.filter(item => item.status === 'PAID');
  const paidCashMonth = paidCash.filter(item => isInMonth(item.paidAt));
  const rejectedCash = cashExpenses.filter(item => item.status === 'REJECTED');
  const openBills = supplierInvoices.filter(item => !['PAID', 'CANCELLED'].includes(item.status) && Number(item.outstandingAmount) > 0.009);
  const overdueBills = openBills.filter(item => item.dueDate < businessDate);
  const readyBills = supplierInvoices.filter(item => ['APPROVED', 'PARTIAL'].includes(item.status) && Number(item.outstandingAmount) > 0.009);
  const unpostedPaidCash = paidCash.filter(item => !item.journal);
  const openCashAmount = openCash.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidCashAmount = paidCashMonth.reduce((sum, item) => sum + Number(item.amount), 0);
  const openBillsAmount = openBills.reduce((sum, item) => sum + Number(item.outstandingAmount), 0);
  const overdueAmount = overdueBills.reduce((sum, item) => sum + Number(item.outstandingAmount), 0);
  const readyBillsAmount = readyBills.reduce((sum, item) => sum + Number(item.outstandingAmount), 0);
  const committedMonth = supplierInvoices
    .filter(item => isInMonth(item.invoiceDate))
    .reduce((sum, item) => sum + Number(item.totalAmount), 0) + paidCashAmount;

  const currentBudget = budgets.find(item => item.periodStart <= businessDate && item.periodEnd >= businessDate) || budgets[0];
  const budgetAmount = currentBudget ? Number(currentBudget.totalExpenseBudget) : 0;
  const budgetUsedPct = budgetAmount > 0 ? Math.round((committedMonth / budgetAmount) * 100) : null;

  const categorySpend = Array.from(paidCashMonth.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + Number(item.amount));
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCategorySpend = Math.max(...categorySpend.map(([, amount]) => amount), 1);

  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(businessDate);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    const day = dayKey(date);
    const cash = paidCash.filter(item => item.paidAt && dayKey(item.paidAt) === day).reduce((sum, item) => sum + Number(item.amount), 0);
    const bills = supplierInvoices.filter(item => dayKey(item.invoiceDate) === day).reduce((sum, item) => sum + Number(item.totalAmount), 0);
    return { label: new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(date), cash, bills };
  });
  const trendMax = Math.max(...trend.flatMap(item => [item.cash, item.bills]), 1);

  const serializedExpenses = cashExpenses.map(item => ({
    id: item.id,
    expenseReference: item.expenseReference,
    status: item.status,
    amount: Number(item.amount),
    currency: item.currency,
    category: item.category,
    description: item.description,
    payee: item.payee,
    receiptUrl: item.receiptUrl,
    costCenter: item.costCenter,
    createdAt: item.createdAt.toISOString(),
  }));

  return <main className="min-h-full bg-[#08111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
    <div className="mx-auto max-w-[1540px] space-y-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-rose-300"><ReceiptText className="h-4 w-4" />Expense control room</div>
          <h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Spend, controlled before it posts.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">A live view of petty-cash requests, supplier commitments, budget pressure, payment readiness, and the controls that protect the hotel’s operating margin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{dateLabel(businessDate)}</strong></span>
          <RecordSupplierBillModal propertyId={propertyId} suppliers={suppliers} />
          <Link href="/accountant/cash-bank/expenses" className="inline-flex items-center gap-2 rounded-xl bg-rose-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-rose-300"><ReceiptText className="h-4 w-4" />New cash expense</Link>
        </div>
      </header>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-rose-400/15 bg-rose-400/[.055] px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/15 text-rose-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-white">Expense close posture</p><p className="mt-1 text-xs text-slate-400">{unpostedPaidCash.length ? `${unpostedPaidCash.length} paid cash expense${unpostedPaidCash.length === 1 ? '' : 's'} have no GL journal.` : openCash.length ? `${openCash.length} cash request${openCash.length === 1 ? '' : 's'} still need approval or payment.` : 'Cash expense controls are clear for the current register.'}</p></div></div>
        <Link href={unpostedPaidCash.length ? '/accountant/gl' : '/accountant/cash-bank/expenses'} className="inline-flex items-center gap-2 text-xs font-semibold text-rose-300 hover:text-rose-200">{unpostedPaidCash.length ? 'Inspect GL exceptions' : 'Open expense register'} <ArrowRight className="h-3.5 w-3.5" /></Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Open cash requests" value={money(openCashAmount, currency)} detail={`${openCash.length} pending approval or payment`} icon={Clock3} tone="amber" />
        <Metric label="Paid this month" value={money(paidCashAmount, currency)} detail={`${paidCashMonth.length} controlled disbursements`} icon={Wallet} tone="emerald" />
        <Metric label="Open supplier AP" value={money(openBillsAmount, currency)} detail={`${openBills.length} invoices outstanding`} icon={Landmark} tone="cyan" />
        <Metric label="Overdue AP" value={money(overdueAmount, currency)} detail={`${overdueBills.length} past due invoices`} icon={AlertTriangle} tone="rose" />
        <Metric label="Ready to pay" value={money(readyBillsAmount, currency)} detail={`${readyBills.length} approved supplier bills`} icon={FileCheck2} tone="violet" />
        <Metric label="Budget consumed" value={budgetUsedPct === null ? 'Not set' : `${budgetUsedPct}%`} detail={budgetAmount ? `${money(committedMonth, currency)} of ${money(budgetAmount, currency)}` : 'No active expense budget'} icon={BarChart3} tone={budgetUsedPct !== null && budgetUsedPct >= 90 ? 'rose' : 'cyan'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Expense production trend" subtitle="Live cash disbursements and supplier invoices recorded across the last 14 business days">
          <div className="flex h-52 items-end gap-1.5 sm:gap-2">{trend.map(item => <div key={item.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-40 w-full items-end justify-center gap-0.5"><span title={`${item.label} cash ${money(item.cash, currency)}`} className="w-1/2 rounded-t bg-rose-400/80" style={{ height: `${Math.max(item.cash / trendMax * 100, item.cash ? 3 : 0)}%` }} /><span title={`${item.label} supplier ${money(item.bills, currency)}`} className="w-1/2 rounded-t bg-cyan-400/75" style={{ height: `${Math.max(item.bills / trendMax * 100, item.bills ? 3 : 0)}%` }} /></div><span className="truncate text-[10px] text-slate-600">{item.label}</span></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Cash paid</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />Supplier invoices</span><span className="ml-auto font-medium text-slate-300">Committed this month {money(committedMonth, currency)}</span></div>
        </Panel>
        <Panel title="Control signals" subtitle="The decisions most likely to affect close quality">
          <div className="space-y-2">
            <Signal title="Approval queue" value={`${openCash.filter(item => item.status === 'PENDING_APPROVAL').length} cash requests`} detail="Awaiting accountable approval" href="/accountant/cash-bank/expenses" icon={Clock3} tone="amber" />
            <Signal title="Posting integrity" value={`${unpostedPaidCash.length} exception${unpostedPaidCash.length === 1 ? '' : 's'}`} detail="Paid expenses without a GL journal" href="/accountant/gl" icon={AlertTriangle} tone={unpostedPaidCash.length ? 'rose' : 'emerald'} />
            <Signal title="Supplier pressure" value={overdueBills.length ? `${money(overdueAmount, currency)} overdue` : 'No overdue AP'} detail="Due-date exposure requiring follow-up" href="/accountant/payables" icon={Landmark} tone={overdueBills.length ? 'rose' : 'emerald'} />
            <Signal title="Budget posture" value={budgetUsedPct === null ? 'Not configured' : `${budgetUsedPct}% consumed`} detail="Committed spend against active budget" href="/accountant/budgets" icon={BarChart3} tone={budgetUsedPct !== null && budgetUsedPct >= 90 ? 'rose' : 'cyan'} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <Panel title="Cash expense mix" subtitle="Paid cash expenses by configured category for the current business month">
          {categorySpend.length ? <div className="space-y-4">{categorySpend.map(([category, amount]) => <div key={category}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate text-slate-300">{category}</span><strong className="shrink-0 text-white">{money(amount, currency)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-rose-400" style={{ width: `${amount / maxCategorySpend * 100}%` }} /></div></div>)}</div> : <EmptyInline text="No paid cash expenses recorded in the current business month." />}
          <div className="mt-5 border-t border-white/[.07] pt-4 text-xs text-slate-500">Category-to-GL mappings are maintained in property expense configuration.</div>
        </Panel>
        <Panel title="Budget and custody" subtitle="Live control accounts and the active expense budget">
          <div className="grid gap-3 sm:grid-cols-2">{cashAccounts.map(account => <div key={account.id} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{account.name}</span><CircleDollarSign className="h-4 w-4 text-emerald-300" /></div><p className="mt-2 text-xl font-semibold text-white">{money(Number(account.balance), currency)}</p><p className="mt-1 text-[11px] text-slate-600">{account.glAccount ? `${account.glAccount.code} · ${account.glAccount.name}` : 'GL mapping required'}</p></div>)}{!cashAccounts.length && <EmptyInline text="No General Cashier Safe is configured." />}</div>
          <div className="mt-4 rounded-xl border border-white/[.08] bg-white/[.025] p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Active budget</span><Link href="/accountant/budgets" className="text-xs font-semibold text-cyan-300">Open budgets</Link></div><p className="mt-2 text-sm font-semibold text-white">{currentBudget?.name || 'No active budget'}</p><p className="mt-1 text-xs text-slate-500">{budgetAmount ? `${money(committedMonth, currency)} committed of ${money(budgetAmount, currency)} expense budget` : 'Configure an approved budget to see variance controls.'}</p>{budgetAmount > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${budgetUsedPct! >= 90 ? 'bg-rose-400' : 'bg-cyan-400'}`} style={{ width: `${Math.min(budgetUsedPct || 0, 100)}%` }} /></div>}</div>
        </Panel>
      </section>

      <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><ReceiptText className="h-4 w-4" />Live cash expense register</div><h2 className="mt-1 text-lg font-semibold text-white">Requests, approvals, and payment control</h2><p className="mt-1 text-xs text-slate-500">Operational actions remain in the controlled workspace; this register is backed by the production cash-expense subledger.</p></div><Link href="/accountant/cash-bank/expenses" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">Open full register <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="mt-5"><ExpenseWorkspace propertyId={propertyId} expenses={serializedExpenses} categories={categories.map(item => ({ id: item.id, code: item.code, name: item.name }))} costCenters={costCenters.map(item => ({ id: item.id, code: item.code, name: item.name }))} role={String((session.user as any).role || '').toUpperCase()} /></div>
      </section>
    </div>
  </main>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: Tone }) {
  const colors: Record<Tone, string> = { emerald: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/15', amber: 'text-amber-300 bg-amber-400/10 ring-amber-400/15', rose: 'text-rose-300 bg-rose-400/10 ring-rose-400/15', cyan: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/15', violet: 'text-violet-300 bg-violet-400/10 ring-violet-400/15' };
  return <div className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div></div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,.1)] sm:p-6"><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></section>;
}

function Signal({ title, value, detail, href, icon: Icon, tone }: { title: string; value: string; detail: string; href: string; icon: React.ElementType; tone: Tone }) {
  const colors: Record<Tone, string> = { emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300', cyan: 'text-cyan-300', violet: 'text-violet-300' };
  return <Link href={href} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 transition hover:border-white/20 hover:bg-white/[.05]"><Icon className={`h-4 w-4 shrink-0 ${colors[tone]}`} /><span className="min-w-0"><span className="block text-[11px] text-slate-500">{title}</span><strong className="mt-1 block truncate text-sm text-white">{value}</strong><span className="mt-1 block truncate text-[11px] text-slate-600">{detail}</span></span><ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-600" /></Link>;
}

function EmptyInline({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-600">{text}</div>; }
function EmptyState({ title }: { title: string }) { return <main className="flex min-h-full items-center justify-center bg-[#08111f] text-slate-300"><div className="text-center"><ReceiptText className="mx-auto mb-3 h-10 w-10 text-slate-600" /><h1 className="text-xl font-semibold text-white">{title}</h1></div></main>; }

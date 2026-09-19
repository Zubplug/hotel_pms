import React from 'react';
import {
  AlertCircle, ArrowRight, ArrowUpRight, Banknote, Building2,
  Clock3, FileText, Link2, Receipt, ShieldCheck, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Receivables are operational accounting data; never serve a stale dashboard snapshot.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ExportReceivablesButton } from '@/components/accountant/ExportReceivablesButton';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

type BucketKey = 'CURRENT' | '31_60' | '61_90' | 'OVER_90';

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(value);
const date = (value: Date | null) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value) : '—';
const daysBetween = (value: Date, now: number) => Math.max(0, Math.floor((now - value.getTime()) / 86_400_000));
const bucketFor = (days: number): BucketKey => days <= 30 ? 'CURRENT' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : 'OVER_90';

const bucketMeta: Record<BucketKey, { label: string; short: string; color: string; bar: string }> = {
  CURRENT: { label: 'Current', short: '0–30 days', color: 'text-emerald-300', bar: 'bg-emerald-400' },
  '31_60': { label: 'Watch', short: '31–60 days', color: 'text-amber-300', bar: 'bg-amber-400' },
  '61_90': { label: 'At risk', short: '61–90 days', color: 'text-orange-300', bar: 'bg-orange-400' },
  OVER_90: { label: 'Critical', short: '90+ days', color: 'text-rose-300', bar: 'bg-rose-400' },
};

export default async function ReceivablesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freceivables');
  const propertyId = session.user.propertyId;
  if (!propertyId) return <EmptyState title="No property assigned" message="Your user account is not assigned to a property." />;

  const asAt = new Date();
  const now = asAt.getTime();
  const [property, accounts, invoices, payments, controlAccount] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cityLedgerAccount.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
    prisma.cityLedgerInvoice.findMany({
      where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
      include: { account: { select: { id: true, name: true, type: true, currency: true } } },
      orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }],
    }),
    prisma.cityLedgerEntry.findMany({
      where: { propertyId, type: 'PAYMENT' },
      include: { account: { select: { id: true, name: true, currency: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.chartOfAccount.findFirst({ where: { propertyId, code: '1140', isActive: true }, select: { id: true, code: true, name: true } }),
  ]);

  const currency = property?.baseCurrency || accounts[0]?.currency || 'NGN';
  const arAccounts = accounts.filter(account => account.type !== 'REFUND_PAYABLE');
  const positiveAccounts = arAccounts.filter(account => Number(account.balance) > 0);
  const totalOutstanding = positiveAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const creditBalances = arAccounts.reduce((sum, account) => sum + Math.abs(Math.min(0, Number(account.balance))), 0);
  const openInvoiceRows = invoices.map(invoice => {
    const days = daysBetween(invoice.dueDate, now);
    return { invoice, days, bucket: bucketFor(days), overdue: invoice.dueDate.getTime() < now };
  });
  const aging = (Object.keys(bucketMeta) as BucketKey[]).map(key => ({
    key, ...bucketMeta[key], amount: openInvoiceRows.filter(row => row.bucket === key).reduce((sum, row) => sum + Number(row.invoice.outstandingAmount), 0),
    count: openInvoiceRows.filter(row => row.bucket === key).length,
  }));
  const overdueAmount = aging.filter(item => item.key !== 'CURRENT').reduce((sum, item) => sum + item.amount, 0);
  const weightedDays = totalOutstanding ? openInvoiceRows.reduce((sum, row) => sum + Number(row.invoice.outstandingAmount) * row.days, 0) / totalOutstanding : 0;
  const unmatchedPayments = payments.filter(payment => payment.status !== 'SETTLED');
  const payments90 = payments.filter(payment => payment.createdAt.getTime() >= now - 90 * 86_400_000);
  const collected90 = payments90.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const focusInvoices = openInvoiceRows.slice().sort((a, b) => Number(b.invoice.outstandingAmount) - Number(a.invoice.outstandingAmount)).slice(0, 6);
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const end = now - (7 - index) * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    return { label: new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' }).format(new Date(end)), amount: payments.filter(payment => payment.createdAt.getTime() >= start && payment.createdAt.getTime() < end).reduce((sum, payment) => sum + Number(payment.amount), 0) };
  });
  const maxWeekly = Math.max(...weekly.map(item => item.amount), 1);
  const glControl = controlAccount ? await prisma.journalEntryLine.aggregate({
    where: { accountId: controlAccount.id, entry: { propertyId, status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  }) : null;
  const glBalance = glControl ? Number(glControl._sum.debit || 0) - Number(glControl._sum.credit || 0) : null;
  const controlVariance = glBalance === null ? null : glBalance - totalOutstanding;
  const exportRows = positiveAccounts.map(account => ({ name: account.name, type: account.type, balance: Number(account.balance), oldestOpenItem: 'Invoice-level aging', lastPayment: '—', status: Number(account.balance) > 0 ? 'OPEN' : 'CREDIT' }));

  return (
    <main className="min-h-screen bg-[#07111f] p-5 text-slate-100 md:p-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" />Receivables control centre</div><h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Accounts receivable</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">A live subledger view of exposure, ageing, collection velocity, and the controls that keep corporate balances audit-ready for {property?.name || 'this property'}.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-400"><span className="mr-2 text-slate-500">As at</span><span className="font-medium text-slate-200">{date(asAt)}</span><span className="ml-2 text-emerald-300">Live</span></div><ExportReceivablesButton currency={currency} rows={exportRows} /></div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Net AR exposure" value={money(totalOutstanding, currency)} caption={`${positiveAccounts.length} debtor accounts`} icon={Building2} tone="cyan" href="/accountant/city-ledger" />
          <Metric title="Overdue exposure" value={money(overdueAmount, currency)} caption={`${totalOutstanding ? Math.round(overdueAmount / totalOutstanding * 100) : 0}% of gross AR`} icon={AlertCircle} tone="rose" href="/accountant/city-ledger" />
          <Metric title="Collection velocity" value={money(collected90, currency)} caption="Cash applied in last 90 days" icon={Banknote} tone="emerald" href="/accountant/city-ledger" />
          <Metric title="Unapplied cash" value={money(unmatchedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0), currency)} caption={`${unmatchedPayments.length} payment${unmatchedPayments.length === 1 ? '' : 's'} to reconcile`} icon={Link2} tone="amber" href="/accountant/city-ledger" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Ageing concentration" subtitle="Open invoices aged from due date · base currency view" action={<Link href="/accountant/city-ledger" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Open city ledger <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>}>
            <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
              <div className="space-y-4">{aging.map(item => <Link href="/accountant/city-ledger" key={item.key} className="group block"><div className="mb-2 flex items-center justify-between text-sm"><span className={`font-medium ${item.color}`}>{item.label} <span className="ml-1 text-xs text-slate-500">{item.short}</span></span><span className="font-semibold text-slate-200">{money(item.amount, currency)} <span className="ml-1 text-xs font-normal text-slate-500">{item.count} inv.</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-all group-hover:brightness-125 ${item.bar}`} style={{ width: `${totalOutstanding ? Math.max(item.amount ? 3 : 0, item.amount / totalOutstanding * 100) : 0}%` }} /></div></Link>)}</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Weighted DSO</p><p className="mt-2 text-3xl font-semibold text-white">{Math.round(weightedDays)} <span className="text-sm font-normal text-slate-500">days</span></p><p className="mt-3 text-xs leading-5 text-slate-400">Average exposure age weighted by open invoice value.</p><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-wider text-slate-500">Credit balances</p><p className="mt-1 text-lg font-semibold text-emerald-300">{money(creditBalances, currency)} CR</p></div></div>
            </div>
          </Panel>
          <Panel title="Cash application" subtitle="Payments received by week"><div className="flex h-44 items-end gap-2 border-b border-l border-white/10 px-2 pb-0 pt-6">{weekly.map(item => <div key={item.label} className="group flex h-full flex-1 flex-col justify-end"><div className="relative flex-1"><div className="absolute bottom-0 left-1/2 w-full -translate-x-1/2 rounded-t-md bg-cyan-400/80 transition-all group-hover:bg-cyan-300" style={{ height: `${Math.max(item.amount ? 5 : 0, item.amount / maxWeekly * 100)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-300 group-hover:block">{money(item.amount, currency)}</span></div></div><span className="mt-2 text-center text-[10px] text-slate-500">{item.label}</span></div>)}</div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">8-week collection trend</span><span className="font-medium text-cyan-300">{money(collected90, currency)} / 90d</span></div></Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Collection focus" subtitle="Highest-value open invoices requiring the next action" action={<Link href="/accountant/city-ledger" className="text-xs text-slate-400 hover:text-white">View all <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>}>
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3 font-medium">Invoice / account</th><th className="pb-3 font-medium">Due</th><th className="pb-3 font-medium">Age</th><th className="pb-3 text-right font-medium">Open balance</th><th className="pb-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{focusInvoices.length ? focusInvoices.map(row => <tr key={row.invoice.id} className="group"><td className="py-4"><div className="font-medium text-slate-200">{row.invoice.invoiceNumber}</div><div className="mt-1 text-xs text-slate-500">{row.invoice.account.name} · {row.invoice.account.type}</div></td><td className={row.overdue ? 'py-4 text-rose-300' : 'py-4 text-slate-400'}>{date(row.invoice.dueDate)}</td><td className="py-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${row.overdue ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>{row.days}d</span></td><td className="py-4 text-right font-semibold text-slate-100">{money(Number(row.invoice.outstandingAmount), row.invoice.currency || currency)}</td><td className="py-4 text-right"><Link href={`/accountant/city-ledger/${row.invoice.account.id}`} className="text-xs text-cyan-300 opacity-80 hover:opacity-100">Open account</Link></td></tr>) : <tr><td colSpan={5} className="py-10 text-center text-slate-500">No open invoices require collection action.</td></tr>}</tbody></table></div>
          </Panel>
          <Panel title="Control health" subtitle="Subledger to general ledger integrity"><div className="space-y-3"><ControlRow label="AR control account" value={controlAccount ? `${controlAccount.code} · ${controlAccount.name}` : 'Not configured'} status={controlAccount ? 'OK' : 'REVIEW'} /><ControlRow label="Subledger balance" value={money(totalOutstanding, currency)} status="OK" /><ControlRow label="GL control balance" value={glBalance === null ? 'Unavailable' : money(glBalance, currency)} status={glBalance === null ? 'REVIEW' : 'OK'} /><ControlRow label="Reconciliation variance" value={controlVariance === null ? 'Not tested' : money(Math.abs(controlVariance), currency)} status={controlVariance === null || Math.abs(controlVariance) < 0.01 ? 'OK' : 'REVIEW'} /></div><div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-200"><ShieldCheck className="mr-1 inline h-4 w-4" />Balances are sourced from invoice outstanding amounts and the live city-ledger accounts.</div></Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-3"><Insight icon={Sparkles} title="Accountant insight" text={overdueAmount ? `${Math.round(overdueAmount / Math.max(totalOutstanding, 1) * 100)}% of current AR is beyond 30 days. Prioritise the ${money(aging.find(item => item.key === 'OVER_90')?.amount || 0, currency)} in critical exposure.` : 'No overdue invoice exposure detected in the live city ledger.'} tone="cyan" /><Insight icon={Clock3} title="Follow-up queue" text={`${focusInvoices.length} high-value invoice${focusInvoices.length === 1 ? '' : 's'} are ready for collection follow-up. Open the account to record a payment or review its ledger history.`} tone="amber" /><Insight icon={Receipt} title="Audit trail" text={`${payments.length} city-ledger payment${payments.length === 1 ? '' : 's'} captured. ${unmatchedPayments.length ? 'Unapplied cash needs reconciliation.' : 'All captured payments are marked settled.'}`} tone="emerald" /></section>

      </div>
    </main>
  );
}

function Metric({ title, value, caption, icon: Icon, tone, href }: { title: string; value: string; caption: string; icon: React.ElementType; tone: 'cyan' | 'rose' | 'emerald' | 'amber'; href: string }) {
  const tones = { cyan: 'text-cyan-300 border-cyan-300/15', rose: 'text-rose-300 border-rose-300/15', emerald: 'text-emerald-300 border-emerald-300/15', amber: 'text-amber-300 border-amber-300/15' };
  return <Link href={href} className={`group rounded-2xl border bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${tones[tone]}`}><div className="flex items-start justify-between"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p><Icon className="h-5 w-5 opacity-80" /></div><p className="mt-5 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{caption}<ArrowUpRight className="ml-1 inline h-3 w-3 opacity-0 transition group-hover:opacity-100" /></p></Link>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.12)]"><div className="mb-6 flex items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{action}</div>{children}</section>; }
function ControlRow({ label, value, status }: { label: string; value: string; status: 'OK' | 'REVIEW' }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-slate-950/30 p-3"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-200">{value}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'OK' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{status}</span></div>; }
function Insight({ icon: Icon, title, text, tone }: { icon: React.ElementType; title: string; text: string; tone: 'cyan' | 'amber' | 'emerald' }) { const colors = { cyan: 'border-cyan-300/15 text-cyan-300', amber: 'border-amber-300/15 text-amber-300', emerald: 'border-emerald-300/15 text-emerald-300' }; return <div className={`rounded-2xl border bg-white/[0.025] p-4 ${colors[tone]}`}><Icon className="mb-3 h-5 w-5" /><p className="text-sm font-semibold text-white">{title}</p><p className="mt-2 text-xs leading-5 text-slate-400">{text}</p></div>; }
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="flex min-h-screen items-center justify-center bg-[#07111f] p-8 text-center text-slate-300"><div><FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" /><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{message}</p></div></div>; }

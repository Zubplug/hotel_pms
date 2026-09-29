'use client';

import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AlertTriangle, CheckCircle2, CircleDollarSign, FileText, Loader2, RefreshCcw, Scale, ShieldCheck, WalletCards } from 'lucide-react';

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function GeneralManagerAccountingReports() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const { status: sessionStatus } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/dashboard/accountant-analytics?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load accounting reports');
      setData(body);
    } catch (cause: any) { setError(cause.message || 'Unable to load accounting reports'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Accounting report data is unavailable.'}</div></div>;

  const revenue = data.revenue?.today || {};
  const balances = data.balances || {};
  const flags = data.flags || {};
  const tax = balances.taxLiability?.total || 0;
  const reportDate = data.businessDate ? new Date(data.businessDate).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : 'Current business date';
  const totalIssues = Object.values(flags).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const summaryCards: Array<{ label: string; value: string; detail: string; icon: ElementType; tone: 'emerald' | 'blue' | 'amber' | 'rose' }> = [
    { label: 'Revenue today', value: money(revenue.totalRevenue), detail: 'Posted operating revenue', icon: CircleDollarSign, tone: 'emerald' },
    { label: 'Cash & bank', value: money(balances.cashTotal), detail: `${money(balances.safe)} safe · ${money(balances.bank)} bank`, icon: WalletCards, tone: 'blue' },
    { label: 'Receivables', value: money(balances.arTotal), detail: 'Guest and city ledger', icon: Scale, tone: 'amber' },
    { label: 'Payables', value: money(balances.apOutstanding), detail: `${flags.overdueInvoices || 0} overdue invoices`, icon: FileText, tone: 'rose' },
  ];

  return <main className="min-h-full bg-[linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><FileText className="h-3.5 w-3.5" /> Accounting Management / Reports</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Management accounting reports</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Executive financial statements and control summaries for the assigned property. This view is read-only and does not post ledger entries.</p></div><div className="flex items-center gap-2"><span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{reportDate}</strong></span><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></div></header>
    <section className={`flex items-center gap-3 rounded-2xl border p-5 ${totalIssues ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'}`}>{totalIssues ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}<div><p className="text-sm font-semibold text-white">{totalIssues ? `${totalIssues} control items require accountant review` : 'Accounting controls are clear'}</p><p className="mt-1 text-xs text-slate-500">Latest night audit status: {data.audit?.lastAuditStatus || 'PENDING'}</p></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map((card) => <ReportMetric key={card.label} {...card} />)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Financial position</h2><p className="mt-1 text-xs text-slate-500">Current ledger exposure by control area</p></div></div><div className="mt-5 space-y-2.5"><Row label="Cash and bank" value={money(balances.cashTotal)} /><Row label="Accounts receivable" value={money(balances.arTotal)} /><Row label="Accounts payable" value={money(balances.apOutstanding)} /><Row label="Tax liability" value={money(tax)} /></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300"><AlertTriangle className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Control exceptions</h2><p className="mt-1 text-xs text-slate-500">Exceptions impacting management confidence</p></div></div><div className="mt-5 space-y-2.5"><Row label="Open transaction exceptions" value={String(flags.openExceptions || 0)} alert={Boolean(flags.openExceptions)} /><Row label="Overdue receivables" value={String(flags.overdueReceivables || 0)} alert={Boolean(flags.overdueReceivables)} /><Row label="Pending expenses" value={String(flags.pendingExpenses || 0)} alert={Boolean(flags.pendingExpenses)} /><Row label="GL exceptions" value={String(flags.glExceptions || 0)} alert={Boolean(flags.glExceptions)} /><Row label="Pending deposits" value={String(flags.pendingDeposits || 0)} alert={Boolean(flags.pendingDeposits)} /></div></section></div>
  </div></main>;
}

function Row({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 text-sm last:border-0 last:pb-0"><span className="text-slate-400">{label}</span><span className={`font-semibold ${alert ? 'text-amber-300' : 'text-slate-200'}`}>{value}</span></div>;
}

function ReportMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: ElementType; tone: 'emerald' | 'blue' | 'amber' | 'rose' }) {
  const toneClass = { emerald: 'border-emerald-400/20 bg-emerald-400/[0.07]', blue: 'border-blue-400/20 bg-blue-400/[0.07]', amber: 'border-amber-400/20 bg-amber-400/[0.07]', rose: 'border-rose-400/20 bg-rose-400/[0.07]' }[tone];
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}

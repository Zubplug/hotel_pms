'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import {
  AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, CircleDollarSign,
  Clock3, Loader2, RefreshCcw, ShieldCheck, WalletCards,
} from 'lucide-react';

type CashAnalytics = {
  generatedAt: string;
  kpis: { receivables: number; receivablesCount: number; pendingApprovals: number };
  departments: {
    cashier: { safeBalance: number; pendingHandovers: number; pendingHandoverValue: number; pendingDeposits: number; pendingDepositValue: number };
    frontdesk: { collections: number; paymentCount: number; openSessions: number; reviewSessions: number; exceptions: number };
  };
  trend: Array<{ date: string; revenue: number }>;
};

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

function Metric({ label, value, detail, tone = 'indigo', icon: Icon }: { label: string; value: string; detail: string; tone?: 'indigo' | 'emerald' | 'amber' | 'rose'; icon: typeof Banknote }) {
  const toneClass = { indigo: 'border-indigo-400/20 bg-indigo-400/[0.07]', emerald: 'border-emerald-400/20 bg-emerald-400/[0.07]', amber: 'border-amber-400/20 bg-amber-400/[0.07]', rose: 'border-rose-400/20 bg-rose-400/[0.07]' }[tone];
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}

function Signal({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3"><div><p className="text-sm text-slate-300">{label}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tone === 'good' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'warn' ? 'bg-amber-400/10 text-amber-300' : tone === 'bad' ? 'bg-rose-400/10 text-rose-300' : 'bg-white/[0.06] text-slate-300'}`}>{value}</span></div>;
}

export default function GeneralManagerCashManagement() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const { status: sessionStatus } = useLodgeCoreSession();
  const [data, setData] = useState<CashAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/dashboard/analytics?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load cash management analytics');
      setData(body.data);
    } catch (cause: any) { setError(cause.message || 'Unable to load cash management analytics'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Cash management data is unavailable.'}</div></div>;

  const cashier = data.departments.cashier;
  const frontdesk = data.departments.frontdesk;
  const openControls = cashier.pendingHandovers + cashier.pendingDeposits + frontdesk.reviewSessions + frontdesk.exceptions + data.kpis.pendingApprovals;
  const maxTrend = Math.max(...data.trend.map((item) => Number(item.revenue || 0)), 1);

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,#102d35_0%,transparent_30%),linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><WalletCards className="h-3.5 w-3.5" /> Finance & Reports / Cash Management</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Cash control center</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Management oversight of cashier custody, front-desk collections, deposits, receivables, and unresolved financial controls.</p></div><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></header>
    <section className="relative overflow-hidden rounded-[26px] border border-emerald-400/20 bg-emerald-400/[0.06] p-6 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${openControls ? 'border-amber-400/25 bg-amber-400/10 text-amber-300' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'}`}>{openControls ? `${openControls} controls need review` : 'Controls in balance'}</span><h2 className="mt-4 text-2xl font-bold text-white">Executive custody and settlement view</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">This page monitors the General Cashier flow. Cash handling, receipt, deposit, and approval actions remain in the cashier workspace.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Safe balance</p><p className="mt-2 text-xl font-bold text-white">{money(cashier.safeBalance)}</p></div><div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Collections</p><p className="mt-2 text-xl font-bold text-white">{money(frontdesk.collections)}</p></div></div></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Safe balance" value={money(cashier.safeBalance)} detail="Current General Cashier safe" icon={WalletCards} tone="emerald" /><Metric label="Pending handovers" value={money(cashier.pendingHandoverValue)} detail={`${cashier.pendingHandovers} custody records`} icon={ArrowUpRight} tone={cashier.pendingHandovers ? 'amber' : 'emerald'} /><Metric label="Pending deposits" value={money(cashier.pendingDepositValue)} detail={`${cashier.pendingDeposits} bank submissions`} icon={Banknote} tone={cashier.pendingDeposits ? 'amber' : 'emerald'} /><Metric label="Receivables exposure" value={money(data.kpis.receivables)} detail={`${data.kpis.receivablesCount} open folios`} icon={CircleDollarSign} tone={data.kpis.receivables ? 'rose' : 'emerald'} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Collections trend</h2><p className="mt-1 text-xs text-slate-500">Live revenue posted across the current control scope</p></div><BarChartIcon /></div><div className="mt-6 flex h-48 items-end gap-2">{data.trend.length ? data.trend.map((item) => <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/80 to-cyan-300/70" style={{ height: `${Math.max((Number(item.revenue || 0) / maxTrend) * 100, 4)}%` }} title={money(item.revenue)} /><span className="text-[9px] text-slate-600">{new Date(item.date).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 3)}</span></div>) : <p className="self-center text-xs text-slate-600">No revenue trend available.</p>}</div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Control queue</h2><p className="mt-1 text-xs text-slate-500">Items requiring ownership or review</p></div></div><div className="mt-5 space-y-2.5"><Signal label="Handover custody" value={String(cashier.pendingHandovers)} detail={money(cashier.pendingHandoverValue)} tone={cashier.pendingHandovers ? 'warn' : 'good'} /><Signal label="Bank deposit queue" value={String(cashier.pendingDeposits)} detail={money(cashier.pendingDepositValue)} tone={cashier.pendingDeposits ? 'warn' : 'good'} /><Signal label="Front-desk sessions" value={String(frontdesk.reviewSessions)} detail="Awaiting review" tone={frontdesk.reviewSessions ? 'warn' : 'good'} /><Signal label="Payment exceptions" value={String(frontdesk.exceptions)} detail="Requires investigation" tone={frontdesk.exceptions ? 'bad' : 'good'} /><Signal label="Management approvals" value={String(data.kpis.pendingApprovals)} detail="Pending decisions" tone={data.kpis.pendingApprovals ? 'warn' : 'good'} /></div></section></div>
    <div className="grid gap-5 lg:grid-cols-3"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Cashier performance</h2><p className="mt-1 text-xs text-slate-500">Custody and settlement posture</p><div className="mt-5 space-y-2"><Signal label="Safe balance" value={money(cashier.safeBalance)} detail="Current balance" tone="good" /><Signal label="Pending handovers" value={String(cashier.pendingHandovers)} detail="Not yet received" tone={cashier.pendingHandovers ? 'warn' : 'good'} /></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Front desk settlement</h2><p className="mt-1 text-xs text-slate-500">Collections and session controls</p><div className="mt-5 space-y-2"><Signal label="Collections" value={money(frontdesk.collections)} detail={`${frontdesk.paymentCount} payments`} tone="good" /><Signal label="Open sessions" value={String(frontdesk.openSessions)} detail="Still active" tone={frontdesk.openSessions ? 'warn' : 'good'} /></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Management actions</h2><p className="mt-1 text-xs text-slate-500">Move from signal to controlled review</p><div className="mt-5 space-y-2"><Link href="/general-manager/approvals" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Review approvals <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link><Link href="/general-manager/night-audit/reconciliation" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Open reconciliation <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link><Link href="/general-manager/night-audit" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Review night close <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link></div></section></div>
  </div></main>;
}

function BarChartIcon() {
  return <div className="flex items-end gap-1 text-emerald-300"><span className="h-3 w-1.5 rounded-sm bg-emerald-300/40" /><span className="h-5 w-1.5 rounded-sm bg-emerald-300/60" /><span className="h-7 w-1.5 rounded-sm bg-emerald-300" /></div>;
}

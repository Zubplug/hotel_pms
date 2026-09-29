'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, CircleDollarSign, FileCheck2, Landmark, Loader2, RefreshCcw, Scale, ShieldCheck, WalletCards } from 'lucide-react';

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

function Card({ label, value, detail, icon: Icon, tone = 'emerald' }: { label: string; value: string; detail: string; icon: ElementType; tone?: 'emerald' | 'blue' | 'amber' | 'rose' }) {
  const toneClass = { emerald: 'border-emerald-400/20 bg-emerald-400/[0.07]', blue: 'border-blue-400/20 bg-blue-400/[0.07]', amber: 'border-amber-400/20 bg-amber-400/[0.07]', rose: 'border-rose-400/20 bg-rose-400/[0.07]' }[tone];
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}

function Signal({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'good' | 'warn' | 'bad' }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3"><div><p className="text-sm text-slate-300">{label}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tone === 'good' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'warn' ? 'bg-amber-400/10 text-amber-300' : 'bg-rose-400/10 text-rose-300'}`}>{value}</span></div>;
}

export default function GeneralManagerAccounting() {
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
      if (!response.ok) throw new Error(body.error || 'Unable to load accounting analytics');
      setData(body);
    } catch (cause: any) { setError(cause.message || 'Unable to load accounting analytics'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Accounting data is unavailable.'}</div></div>;

  const balances = data.balances || {};
  const flags = data.flags || {};
  const revenue = data.revenue?.today || {};
  const trend = Array.isArray(data.trends?.revenue?.days) ? data.trends.revenue.days : [];
  const cashFlow = Array.isArray(data.trends?.cashFlow) ? data.trends.cashFlow : [];
  const issues = Object.values(flags).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const maxRevenue = Math.max(...trend.map((item: any) => Number(item.revenue || 0)), 1);
  const closeReady = issues === 0 && data.audit?.lastAuditStatus === 'COMPLETED';

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,#162d39_0%,transparent_30%),linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><Scale className="h-3.5 w-3.5" /> Administration / Accounting Management</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Accounting control center</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Management oversight of revenue integrity, liquidity, ledger exposure, tax position, and the accountant’s close queue.</p></div><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></header>
    <section className={`flex flex-col justify-between gap-4 rounded-[24px] border p-6 sm:flex-row sm:items-center ${closeReady ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-amber-400/20 bg-amber-400/[0.06]'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${closeReady ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{closeReady ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span><div><h2 className="text-lg font-bold text-white">{closeReady ? 'Close posture is clear' : `${issues} accounting control${issues === 1 ? '' : 's'} need review`}</h2><p className="mt-1 text-xs text-slate-400">Last night audit: <span className="font-semibold text-slate-300">{data.audit?.lastAuditStatus || 'PENDING'}</span>{data.businessDate ? ` · Business date ${new Date(data.businessDate).toLocaleDateString('en-NG', { dateStyle: 'medium' })}` : ''}</p></div></div><Link href="/general-manager/night-audit" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/[0.12]">Review close controls <ArrowUpRight className="h-3.5 w-3.5" /></Link></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Revenue today" value={money(revenue.totalRevenue)} detail="Posted accounting revenue" icon={CircleDollarSign} /><Card label="Cash & bank" value={money(balances.cashTotal)} detail={`${money(balances.safe)} safe · ${money(balances.bank)} bank`} icon={WalletCards} tone="blue" /><Card label="Accounts receivable" value={money(balances.arTotal)} detail="Guest and city ledger exposure" icon={Landmark} tone="amber" /><Card label="Accounts payable" value={money(balances.apOutstanding)} detail={`${flags.overdueInvoices || 0} overdue supplier invoices`} icon={FileCheck2} tone="rose" /></div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Revenue integrity trend</h2><p className="mt-1 text-xs text-slate-500">Live posted revenue by business date</p></div><BarChart3 className="h-4 w-4 text-emerald-300" /></div><div className="mt-6 flex h-48 items-end gap-2">{trend.length ? trend.map((item: any) => <div key={item.businessDate} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/80 to-cyan-300/70" style={{ height: `${Math.max((Number(item.revenue || 0) / maxRevenue) * 100, 4)}%` }} title={money(item.revenue)} /><span className="text-[9px] text-slate-600">{new Date(item.businessDate).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 3)}</span></div>) : <p className="self-center text-xs text-slate-600">No revenue trend available.</p>}</div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><h2 className="text-sm font-bold text-white">Accountant close queue</h2><p className="mt-1 text-xs text-slate-500">Controls requiring ownership</p><div className="mt-5 space-y-2.5"><Signal label="Open exceptions" value={String(flags.openExceptions || 0)} detail="Transactions requiring review" tone={flags.openExceptions ? 'bad' : 'good'} /><Signal label="Overdue receivables" value={String(flags.overdueReceivables || 0)} detail="City and guest ledger" tone={flags.overdueReceivables ? 'warn' : 'good'} /><Signal label="Pending expenses" value={String(flags.pendingExpenses || 0)} detail="Awaiting approval" tone={flags.pendingExpenses ? 'warn' : 'good'} /><Signal label="GL exceptions" value={String(flags.glExceptions || 0)} detail="Draft or unbalanced entries" tone={flags.glExceptions ? 'bad' : 'good'} /><Signal label="Pending deposits" value={String(flags.pendingDeposits || 0)} detail="Not yet posted" tone={flags.pendingDeposits ? 'warn' : 'good'} /></div></section></div>
    <div className="grid gap-5 lg:grid-cols-3"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Liquidity movement</h2><p className="mt-1 text-xs text-slate-500">Latest cash flow position</p><div className="mt-5 space-y-2"><Signal label="Latest inflow" value={money(cashFlow.at(-1)?.inflow)} detail="Recorded cash inflow" tone="good" /><Signal label="Latest outflow" value={money(cashFlow.at(-1)?.outflow)} detail="Recorded cash outflow" tone="warn" /></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Tax & compliance</h2><p className="mt-1 text-xs text-slate-500">Statutory exposure visibility</p><div className="mt-5 space-y-2"><Signal label="Tax liability" value={money(balances.taxLiability?.total)} detail="Current liability balance" tone={balances.taxLiability?.total ? 'warn' : 'good'} /><Signal label="Audit status" value={data.audit?.lastAuditStatus || 'PENDING'} detail="Latest completed close" tone={data.audit?.lastAuditStatus === 'COMPLETED' ? 'good' : 'warn'} /></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="text-sm font-bold text-white">Management links</h2><p className="mt-1 text-xs text-slate-500">Move from signal to evidence</p><div className="mt-5 space-y-2"><Link href="/general-manager/night-audit/reconciliation" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Revenue reconciliation <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link><Link href="/reports/receivables" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Receivables report <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link><Link href="/reports" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-slate-300 hover:bg-white/[0.06]">Management reports <ArrowUpRight className="h-4 w-4 text-indigo-300" /></Link></div></section></div>
  </div></main>;
}

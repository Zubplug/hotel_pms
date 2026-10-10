'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import type { NightAuditData } from '@/types/night-audit';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, BedDouble,
  Banknote, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, FileCheck2,
  FileText, Loader2, MoonStar, RefreshCcw, ScanLine, ShieldCheck, Sparkles,
  TriangleAlert, WalletCards, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateLabel = (value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => value
  ? new Intl.DateTimeFormat('en-NG', options || { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

const percent = (value: number) => `${Math.round(value)}%`;

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo' }) {
  const styles = {
    slate: 'border-white/10 bg-white/[0.04] text-slate-400',
    green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    red: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    indigo: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${styles[tone]}`}>{children}</span>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'indigo', trend }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'indigo' | 'green' | 'amber' | 'red'; trend?: 'up' | 'down' }) {
  const styles = {
    indigo: 'border-indigo-400/15 bg-indigo-400/[0.06] text-indigo-300',
    green: 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300',
    amber: 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300',
    red: 'border-rose-400/15 bg-rose-400/[0.06] text-rose-300',
  };
  return <div className={`rounded-2xl border p-4 transition-colors hover:bg-white/[0.06] ${styles[tone]}`}>
    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span><Icon className="h-4 w-4" /></div>
    <div className="mt-3 flex items-end justify-between gap-2"><span className="text-2xl font-bold tracking-tight text-white">{value}</span>{trend && <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">{trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-rose-400" />}{trend === 'up' ? 'On track' : 'Needs review'}</span>}</div>
    <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
  </div>;
}

function Panel({ title, detail, icon: Icon, action, children, className = '' }: { title: string; detail: string; icon: LucideIcon; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d1424]/80 shadow-[0_20px_60px_rgba(0,0,0,0.12)] ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></div>{action}
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>;
}

function Sparkline({ points }: { points: Array<{ value: number }> }) {
  if (!points.length) return <div className="flex h-28 items-center justify-center text-xs text-slate-600">No completed audit trend available.</div>;
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);
  const path = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${90 - ((point.value - min) / range) * 72}`).join(' ');
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full overflow-visible"><defs><linearGradient id="auditChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#818cf8" stopOpacity=".35" /><stop offset="1" stopColor="#818cf8" stopOpacity="0" /></linearGradient></defs><polygon points={`0,100 ${path} 100,100`} fill="url(#auditChartFill)" /><polyline points={path} fill="none" stroke="#818cf8" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function GeneralManagerNightAudit() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [flash, setFlash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<{ severity: string; title: string; detail: string; metric: number } | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load night audit controls');
      setData(body.data);
      const flashResponse = await fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${body.data.businessDate}`, { cache: 'no-store' });
      if (flashResponse.ok) setFlash((await flashResponse.json()).data);
    } catch (cause: any) { setError(cause.message || 'Unable to load night audit controls'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [propertyId]);

  const currency = data?.property.baseCurrency || 'NGN';
  const rooms = data?.analytics.rooms ?? { total: 0, occupied: 0, available: 0, outOfOrder: 0 };
  const occupancy = rooms.total ? (rooms.occupied / rooms.total) * 100 : 0;
  const trend = data?.analytics.trend || [];
  const currentRevenue = Number(data?.analytics.revenue || 0);
  const revenue = useMemo(() => ({
    room: Number(flash?.roomRevenue ?? data?.financialSnapshot?.roomRevenue ?? 0),
    fnb: Number(flash?.fbRevenue ?? data?.financialSnapshot?.fnbRevenue ?? 0),
    other: Number(flash?.otherRevenue ?? data?.financialSnapshot?.otherRevenue ?? 0),
  }), [data, flash]);
  const revenueTotal = revenue.room + revenue.fnb + revenue.other;
  const openItems = (data?.summary.blockers || 0) + (data?.summary.warnings || 0);
  const systemCount = (data?.system.openPosSessions?.length || 0) + (data?.system.openFrontdeskSessions?.length || 0) + (data?.system.financialSyncConflicts?.length || 0) + (data?.system.openPosOrders?.length || 0);
  const financialCount = (data?.financial.highBalances?.length || 0) + (data?.financial.pendingDiscounts?.length || 0) + (data?.financial.rateVariances?.length || 0) + (data?.accounting?.transactionExceptions || 0);
  const cashCount = (data?.cash.cashHandovers?.length || 0) + (data?.cash.unverifiedTransactions?.length || 0) + (data?.cash.bankDeposits?.length || 0);
  const fnbCount = (data?.fnb?.exceptions.openOrders?.length || 0) + (data?.fnb?.exceptions.openSessions?.length || 0) + (data?.fnb?.exceptions.unreviewedVoids?.length || 0);
  const readiness = Math.max(0, Math.min(100, 100 - ((data?.summary.blockers || 0) * 18) - ((data?.summary.warnings || 0) * 7)));

  if (propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#070d19]"><Loader2 className="h-7 w-7 animate-spin text-indigo-400" /></div>;
  if (!propertyId) return <div className="flex min-h-[70vh] items-center justify-center bg-[#070d19] text-sm text-slate-400">Select an assigned property to view Night Audit.</div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#070d19] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Night Audit data is unavailable.'}</div></div>;

  const statusTone = data.auditState === 'COMPLETED' ? 'green' : data.summary.blockers ? 'red' : data.summary.warnings ? 'amber' : 'indigo';
  const statusLabel = data.auditState.replaceAll('_', ' ');
  const controlMap: Array<{ label: string; count: number; icon: LucideIcon; href: string }> = [
    { label: 'System & integrations', count: systemCount, icon: ScanLine, href: '/general-manager/night-audit/reconciliation' },
    { label: 'Financial integrity', count: financialCount, icon: CircleDollarSign, href: '/general-manager/night-audit/reports' },
    { label: 'Cash & settlements', count: cashCount, icon: Banknote, href: '/general-manager/cash-management' },
    { label: 'F&B / outlet close', count: fnbCount, icon: WalletCards, href: '/general-manager/fnb' },
  ];

  return <main className="min-h-full bg-[radial-gradient(circle_at_80%_0%,#202052_0%,transparent_30%),radial-gradient(circle_at_0%_40%,#101d35_0%,transparent_25%),#070d19 px-3 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
    <div className="mx-auto max-w-[1580px] space-y-4 sm:space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300"><MoonStar className="h-3.5 w-3.5" /> General manager / Night audit</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Close with confidence.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">A live command centre for financial integrity, operational continuity, and the next business day.</p></div>
        <div className="flex w-full flex-col gap-2 min-[420px]:flex-row lg:w-auto"><div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-slate-500">Business date <strong className="ml-1 text-slate-200">{dateLabel(data.businessDate)}</strong></div><button onClick={() => load(true)} disabled={refreshing} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.1] disabled:opacity-50 lg:flex-none"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data</button></div>
      </header>

      <section className="relative overflow-hidden rounded-[28px] border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[0.16] via-[#121a36] to-[#0e1528] p-6 shadow-[0_24px_80px_rgba(50,43,140,0.18)] sm:p-8"><div className="pointer-events-none absolute -right-28 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" /><div className="relative grid gap-8 xl:grid-cols-[1fr_390px] xl:items-center"><div><div className="flex flex-wrap items-center gap-3"><Pill tone={statusTone}>{statusLabel}</Pill><span className="text-xs text-slate-500">{data.property.name} · {data.property.timezone}</span></div><h2 className="mt-4 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">{data.auditState === 'COMPLETED' ? 'The business date is closed and evidenced.' : openItems ? 'Your close needs management attention.' : 'The property is ready for close review.'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{data.auditState === 'COMPLETED' ? 'Review the evidence trail, revenue movement, and unresolved exceptions before handing over to the day team.' : 'Resolve blockers first, then validate revenue, cash, outlet, and ledger controls in sequence.'}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/general-manager/night-audit/reconciliation" className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400">Open reconciliation <ChevronRight className="h-4 w-4" /></Link><Link href="/general-manager/night-audit/reports" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.1]"><FileText className="h-4 w-4" /> View reports</Link></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2"><div className="rounded-2xl border border-white/[0.09] bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Readiness</p><p className="mt-2 text-3xl font-bold text-white">{readiness}%</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" style={{ width: `${readiness}%` }} /></div></div><div className="rounded-2xl border border-white/[0.09] bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Open controls</p><p className="mt-2 text-3xl font-bold text-white">{openItems}</p><p className="mt-1 text-[11px] text-slate-500">{data.summary.blockers} blockers · {data.summary.warnings} warnings</p></div><div className="rounded-2xl border border-white/[0.09] bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Last completed</p><p className="mt-2 text-sm font-bold text-white">{dateLabel(data.lastCompletedAudit?.businessDate)}</p><p className="mt-1 text-[11px] text-slate-500">{dateLabel(data.lastCompletedAudit?.completedAt, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</p></div><div className="rounded-2xl border border-white/[0.09] bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">In-house guests</p><p className="mt-2 text-3xl font-bold text-white">{data.analytics.inHouseGuests}</p><p className="mt-1 text-[11px] text-slate-500">live occupancy base</p></div></div></div></section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Revenue posted" value={money(currentRevenue, currency)} detail="All folio charges today" icon={CircleDollarSign} tone="green" trend="up" /><MetricCard label="Occupancy" value={percent(occupancy)} detail={`${rooms.occupied} of ${rooms.total} rooms occupied`} icon={BedDouble} tone="indigo" /><MetricCard label="ADR / RevPAR" value={`${money(flash?.adr ?? data.lastCompletedAudit?.adr, currency)} / ${money(flash?.revPar ?? data.lastCompletedAudit?.revpar, currency)}`} detail="Last completed business date" icon={BarChart3} /><MetricCard label="Cash variance" value={money(data.analytics.cashVariance, currency)} detail="POS expected vs declared" icon={WalletCards} tone={data.analytics.cashVariance ? 'red' : 'green'} trend={data.analytics.cashVariance ? 'down' : 'up'} /><MetricCard label="Late postings" value={String(data.analytics.latePostings)} detail="Requires management awareness" icon={Clock3} tone={data.analytics.latePostings ? 'amber' : 'green'} /></div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"><Panel title="Revenue intelligence" detail="Seven-day completed audit trend and today's mix" icon={CircleDollarSign} action={<Link href="/general-manager/night-audit/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Open manager flash <ArrowUpRight className="h-3.5 w-3.5" /></Link>}><div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr]"><div><div className="mb-4 flex items-start justify-between"><div><p className="text-2xl font-bold text-white">{money(revenueTotal || currentRevenue, currency)}</p><p className="mt-1 text-xs text-slate-500">Revenue mix from the current financial snapshot</p></div><Pill tone="green">Live folio</Pill></div><div className="space-y-4">{[['Rooms', revenue.room, 'bg-indigo-400'], ['F&B', revenue.fnb, 'bg-emerald-400'], ['Other', revenue.other, 'bg-violet-400']].map(([label, amount, color]) => { const value = Number(amount); const share = revenueTotal ? (value / revenueTotal) * 100 : 0; return <div key={String(label)}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-200">{money(value, currency)} <span className="ml-1 text-slate-600">{percent(share)}</span></span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${color}`} style={{ width: `${value ? Math.max(share, 3) : 0}%` }} /></div></div>; })}</div></div><div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-300">Revenue trajectory</span><span className="text-[10px] text-slate-600">Last {trend.length || 0} closes</span></div><div className="mt-4"><Sparkline points={trend.map((point) => ({ value: Number(point.totalRevenue || 0) }))} /></div><div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>{trend[0] ? dateLabel(trend[0].businessDate, { day: '2-digit', month: 'short' }) : '—'}</span><span>{trend.at(-1) ? dateLabel(trend.at(-1)?.businessDate, { day: '2-digit', month: 'short' }) : '—'}</span></div></div></div></Panel><Panel title="Close control map" detail="Ownership by operating domain" icon={ShieldCheck}><div className="space-y-2">{controlMap.map((control) => <Link href={control.href} key={control.label} className="group flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition hover:border-indigo-400/20 hover:bg-indigo-400/[0.06]"><span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400 group-hover:text-indigo-300"><control.icon className="h-4 w-4" /></span><span className="text-xs font-semibold text-slate-300">{control.label}</span></span><span className="flex items-center gap-2"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${control.count ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{control.count}</span><ChevronRight className="h-4 w-4 text-slate-600" /></span></Link>)}</div><div className="mt-5 rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.06] p-4"><div className="flex gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" /><p className="text-xs leading-5 text-slate-400">Resolve blockers in system and financial controls first. Cash handovers and operational movement remain visible without hiding the critical path.</p></div></div></Panel></div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]"><Panel title="Operating pulse" detail="Rooms, movement, and service continuity for this business date" icon={BedDouble}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><MetricCard label="Occupied" value={String(rooms.occupied)} detail={`of ${rooms.total} rooms`} icon={BedDouble} /><MetricCard label="Available" value={String(rooms.available)} detail="Sellable inventory" icon={CheckCircle2} tone="green" /><MetricCard label="Arrivals" value={String(data.operational.arrivals.length)} detail="Expected today" icon={ArrowDownRight} tone="amber" /><MetricCard label="Departures" value={String(data.operational.departures.length)} detail="Expected today" icon={ArrowUpRight} tone="amber" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Out of order</p><p className="mt-2 text-xl font-bold text-white">{rooms.outOfOrder}</p></div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Room checks</p><p className="mt-2 text-xl font-bold text-white">{data.operational.roomReconciliation.length}</p></div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Open POS orders</p><p className="mt-2 text-xl font-bold text-white">{data.system.openPosOrders.length}</p></div></div></Panel><Panel title="Evidence & ledger integrity" detail="Proof that the close can be trusted" icon={FileCheck2}><div className="space-y-3">{[['Close package', data.closeControl?.package ? 'Available' : 'Pending', Boolean(data.closeControl?.package)], ['Journal control', data.accounting?.journal?.status || 'Not run', data.accounting?.journal?.status === 'BALANCED'], ['Balance proof', data.closeControl?.balanceProofStatus || 'Pending', Boolean(data.closeControl?.hasOpeningClosingBalance)], ['Accounting period', data.accounting?.period?.status || 'Not configured', data.accounting?.period?.status === 'OPEN']].map(([label, value, ok]) => <div key={String(label)} className="flex items-center justify-between border-b border-white/[0.05] pb-3 text-sm"><span className="text-slate-400">{label}</span><span className={`flex items-center gap-2 font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}{value}</span></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Link href="/general-manager/night-audit/history" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]">Audit history <ArrowUpRight className="h-3.5 w-3.5" /></Link><Link href="/general-manager/accounting" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]">Open accounting <ArrowUpRight className="h-3.5 w-3.5" /></Link></div></Panel></div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Panel title="Management insights" detail="Prioritised signals generated from the live audit controls" icon={Sparkles} action={<span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">{data.insights?.length || 0} signals</span>}><div className="space-y-2">{data.insights?.length ? data.insights.map((insight) => <button key={`${insight.title}-${insight.metric}`} onClick={() => setSelectedInsight(insight)} className="flex w-full items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:border-indigo-400/20 hover:bg-white/[0.05]"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${insight.severity === 'HIGH' ? 'bg-rose-400/10 text-rose-300' : 'bg-amber-400/10 text-amber-300'}`}>{insight.severity === 'HIGH' ? <TriangleAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white">{insight.title}</span><Pill tone={insight.severity === 'HIGH' ? 'red' : 'amber'}>{insight.severity}</Pill></span><span className="mt-1 block text-xs leading-5 text-slate-500">{insight.detail}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" /></button>) : <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-center"><CheckCircle2 className="h-8 w-8 text-emerald-400" /><p className="mt-3 text-sm font-semibold text-white">No priority signals</p><p className="mt-1 text-xs text-slate-500">Live control checks are clear for this business date.</p></div>}</div></Panel><Panel title="Activity stream" detail="Latest operational events and control evidence" icon={Activity} action={<Link href="/general-manager/night-audit/history" className="text-xs font-semibold text-indigo-300">View history</Link>}><div className="space-y-1">{data.activityFeed?.slice(0, 6).map((event: any) => <div key={event.id} className="flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-0"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.severity === 'CRITICAL' ? 'bg-rose-400' : event.severity === 'WARNING' ? 'bg-amber-400' : 'bg-slate-500'}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{event.title}</p><p className="mt-1 truncate text-[11px] text-slate-600">{event.description || event.actorName || 'System event'}</p></div><time className="shrink-0 text-[10px] text-slate-600">{dateLabel(event.occurredAt, { hour: '2-digit', minute: '2-digit' })}</time></div>)}{!data.activityFeed?.length && <div className="flex min-h-40 items-center justify-center text-xs text-slate-600">No significant events recorded.</div>}</div></Panel></div>
    </div>

    {selectedInsight && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setSelectedInsight(null)}><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#10182a] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><Pill tone={selectedInsight.severity === 'HIGH' ? 'red' : 'amber'}>{selectedInsight.severity} priority</Pill><h2 className="mt-4 text-xl font-bold text-white">{selectedInsight.title}</h2></div><button onClick={() => setSelectedInsight(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white" aria-label="Close insight"><X className="h-5 w-5" /></button></div><p className="mt-4 text-sm leading-6 text-slate-400">{selectedInsight.detail}</p><div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><span className="text-xs text-slate-500">Recorded metric</span><span className="text-lg font-bold text-white">{selectedInsight.metric}</span></div><div className="mt-6 flex justify-end"><Link href="/general-manager/night-audit/reconciliation" onClick={() => setSelectedInsight(null)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-400">Open control centre <ChevronRight className="h-4 w-4" /></Link></div></div></div>}
  </main>;
}

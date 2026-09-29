'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  AlertTriangle, ArrowUpRight, BarChart3, BedDouble, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, FileCheck2, Loader2, MoonStar, RefreshCcw,
  ShieldCheck, Sparkles, WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateLabel = (value: string | Date | null | undefined) => value
  ? new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

function Metric({ label, value, detail, icon: Icon, tone = 'indigo' }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    indigo: 'border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300',
    emerald: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300',
    amber: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300',
    rose: 'border-rose-400/20 bg-rose-400/[0.07] text-rose-300',
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4" /></div>
    <p className="mt-3 text-2xl font-bold tracking-tight text-white">{value}</p>
    <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
  </div>;
}

function Section({ title, detail, icon: Icon, children, action }: { title: string; detail: string; icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.025]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></div>{action}
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>;
}

export default function GeneralManagerNightAudit() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [flash, setFlash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load night audit controls');
      setData(body.data);
      const flashResponse = await fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${body.data.businessDate}`);
      if (flashResponse.ok) setFlash((await flashResponse.json()).data);
    } catch (cause: any) { setError(cause.message || 'Unable to load night audit controls'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [propertyId]);

  const currency = data?.property.baseCurrency || 'NGN';
  const rooms = data?.analytics.rooms;
  const trend = data?.analytics.trend || [];
  const maxRevenue = Math.max(...trend.map(point => Number(point.totalRevenue || 0)), 1);
  const revenue = useMemo(() => ({
    room: Number(flash?.roomRevenue ?? data?.financialSnapshot?.roomRevenue ?? 0),
    fnb: Number(flash?.fbRevenue ?? data?.financialSnapshot?.fnbRevenue ?? 0),
    other: Number(flash?.otherRevenue ?? data?.financialSnapshot?.otherRevenue ?? 0),
  }), [data, flash]);
  const openItems = (data?.summary.blockers || 0) + (data?.summary.warnings || 0);
  if (propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-indigo-400" /></div>;
  if (!propertyId) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18] text-sm text-slate-400">Select an assigned property to view Night Audit.</div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Night Audit data is unavailable.'}</div></div>;

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,#17133b_0%,transparent_30%),linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8">
    <div className="mx-auto max-w-[1540px] space-y-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400"><MoonStar className="h-3.5 w-3.5" /> Finance & Reports / Night Audit</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Executive audit control</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">A management view of close readiness, revenue integrity, operating risk, and the last completed business date.</p></div>
        <div className="flex items-center gap-2"><span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{dateLabel(data.businessDate)}</strong></span><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></div>
      </header>

      <section className="relative overflow-hidden rounded-[26px] border border-indigo-400/20 bg-indigo-400/[0.07] p-6 sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><div className="flex items-center gap-3"><span className="rounded-full border border-indigo-300/25 bg-indigo-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-200">{data.auditState.replaceAll('_', ' ')}</span><span className="text-xs text-slate-500">{data.property.name}</span></div><h2 className="mt-4 text-2xl font-bold text-white">{data.auditState === 'COMPLETED' ? 'Business date closed with evidence' : openItems ? 'Management review required before close' : 'Close controls are ready for review'}</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">The executive workspace monitors the audit. Night Auditors retain the operational execution and posting controls.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Open controls</p><p className="mt-2 text-3xl font-bold text-white">{openItems}</p></div><div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Occupancy</p><p className="mt-2 text-3xl font-bold text-white">{rooms.total ? Math.round((rooms.occupied / rooms.total) * 100) : 0}%</p></div><div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Last close</p><p className="mt-2 text-sm font-bold text-white">{dateLabel(data.lastCompletedAudit?.businessDate)}</p></div></div></div></section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Revenue posted" value={money(data.analytics.revenue, currency)} detail="Current business date" icon={CircleDollarSign} tone="emerald" /><Metric label="ADR / RevPAR" value={`${money(flash?.adr ?? data.lastCompletedAudit?.adr, currency)} / ${money(flash?.revPar ?? data.lastCompletedAudit?.revpar, currency)}`} detail="Yield performance" icon={BarChart3} /><Metric label="Cash variance" value={money(data.analytics.cashVariance, currency)} detail="Expected versus declared" icon={WalletCards} tone={data.analytics.cashVariance ? 'rose' : 'emerald'} /><Metric label="Late postings" value={String(data.analytics.latePostings)} detail="Requires management awareness" icon={Clock3} tone={data.analytics.latePostings ? 'amber' : 'emerald'} /></div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Section title="Revenue mix & business-date performance" detail="Posted activity from the live folio and financial snapshot" icon={CircleDollarSign} action={<Link href="/general-manager/night-audit/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Open reports <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-4">{[['Room revenue', revenue.room, 'bg-indigo-400'], ['F&B revenue', revenue.fnb, 'bg-emerald-400'], ['Other revenue', revenue.other, 'bg-violet-400']].map(([label, amount, color]) => { const total = revenue.room + revenue.fnb + revenue.other; const pct = total ? (Number(amount) / total) * 100 : 0; return <div key={String(label)}><div className="flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-200">{money(amount, currency)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, amount ? 3 : 0)}%` }} /></div></div>; })}</div><div className="flex min-h-[170px] items-end gap-2 rounded-2xl border border-white/[0.05] bg-black/10 p-4">{trend.length ? trend.map((point) => <div key={String(point.businessDate)} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-indigo-500/80 to-violet-300/70" style={{ height: `${Math.max((Number(point.totalRevenue || 0) / maxRevenue) * 100, 4)}%` }} title={money(point.totalRevenue, currency)} /><span className="text-[9px] text-slate-600">{new Date(point.businessDate).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 3)}</span></div>) : <p className="self-center text-xs text-slate-600">No completed audit trend available.</p>}</div></div>
        </Section>
        <Section title="Control health" detail="Executive exception ownership" icon={ShieldCheck}><div className="space-y-3">{[['System controls', data.system.openPosSessions.length + data.system.openFrontdeskSessions.length + data.system.financialSyncConflicts.length], ['Financial controls', data.financial.highBalances.length + data.financial.pendingDiscounts.length + data.financial.rateVariances.length], ['Cash controls', data.cash.cashHandovers.length + data.cash.unverifiedTransactions.length], ['Operations', data.operational.arrivals.length + data.operational.departures.length]].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3"><span className="text-sm text-slate-400">{label}</span><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${count ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{count} {count === 1 ? 'item' : 'items'}</span></div>)}</div><div className="mt-5 flex items-start gap-3 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.06] p-3 text-xs leading-relaxed text-slate-400"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />Prioritize financial and cash exceptions before approving the close package.</div></Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2"><Section title="Property operating snapshot" detail="Rooms and movement for the active business date" icon={BedDouble}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Occupied" value={String(rooms.occupied)} detail={`of ${rooms.total} rooms`} icon={BedDouble} tone="indigo" /><Metric label="Available" value={String(rooms.available)} detail="Sellable inventory" icon={BedDouble} tone="emerald" /><Metric label="Arrivals" value={String(data.operational.arrivals.length)} detail="Expected today" icon={ArrowUpRight} /><Metric label="Departures" value={String(data.operational.departures.length)} detail="Expected today" icon={ChevronRight} tone="amber" /></div></Section><Section title="Close evidence" detail="Immutable record and accounting integrity" icon={FileCheck2}><div className="space-y-3 text-sm">{[['Close package', data.closeControl?.package ? 'Available' : 'Pending', !!data.closeControl?.package], ['Journal control', data.accounting?.journal?.status || 'Not run', data.accounting?.journal?.status === 'BALANCED'], ['Balance proof', data.closeControl?.balanceProofStatus || 'Pending', !!data.closeControl?.hasOpeningClosingBalance]].map(([label, value, ok]) => <div key={String(label)} className="flex items-center justify-between border-b border-white/[0.05] pb-3"><span className="text-slate-400">{label}</span><span className={`flex items-center gap-2 font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{value}</span></div>)}</div><Link href="/night-audit/reports" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Review audit evidence <ArrowUpRight className="h-3.5 w-3.5" /></Link></Section></div>
    </div>
  </main>;
}

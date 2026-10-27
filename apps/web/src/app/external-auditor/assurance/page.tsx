'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  FileCheck2,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';

type Assurance = {
  scope: {
    propertyId: string;
    propertyName: string;
    currency: string;
    auditPeriodStart: string;
    auditPeriodEnd: string;
  };
  reconciliation: {
    folioCharges: number;
    postedRevenue: number;
    revenueDifference: number;
    cashExpected: number;
    cashDeclared: number;
    cashVariance: number;
    posSettlementCount: number;
    posVariance: number;
    closePackages: number;
    finalizedClosePackages: number;
    latestClose?: {
      status: string;
      finalizedAt?: string | null;
      packageHash?: string | null;
    } | null;
  };
  snapshots: Array<{
    cashExpected: number;
    cashDeclared: number;
    cashVariance: number;
    grossRevenue: number;
    netRevenue: number;
    reconciliationStatus: string;
    finalizedAt: string | null;
  }>;
};

type PeriodKey = 'engagement' | '7d' | 'mtd' | 'ytd' | 'custom';

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const human = (value: string) =>
  value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());

const dateKey = (value: Date) =>
  `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, '0')}-${`${value.getDate()}`.padStart(2, '0')}`;

const periodRange = (key: Exclude<PeriodKey, 'engagement' | 'custom'>) => {
  const today = new Date();
  if (key === '7d') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: dateKey(start), end: dateKey(today) };
  }
  if (key === 'mtd') {
    return { start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: dateKey(today) };
  }
  return { start: dateKey(new Date(today.getFullYear(), 0, 1)), end: dateKey(today) };
};

const formatPeriod = (start: string, end: string) =>
  `${new Date(`${start}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${end}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;

const isZero = (value: number) => Math.abs(value) < 0.01;

export default function AuditorAssurancePage() {
  const [data, setData] = useState<Assurance | null>(null);
  const [scope, setScope] = useState<Assurance['scope'] | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('engagement');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (
    propertyId: string,
    nextPeriod: PeriodKey,
    start = customStart,
    end = customEnd,
  ) => {
    const selected =
      nextPeriod === 'engagement'
        ? { start: '', end: '' }
        : nextPeriod === 'custom'
          ? { start, end }
          : periodRange(nextPeriod);
    const params = new URLSearchParams({ propertyId });
    if (selected.start) params.set('startDate', selected.start);
    if (selected.end) params.set('endDate', selected.end);

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/external-auditor/assurance?${params}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Unable to load assurance data');
      setData(result);
      setScope(result.scope);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load assurance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context')
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok || !value.scopes?.[0]) throw new Error(value.error || 'No active engagement');
        return value.scopes[0] as Assurance['scope'];
      })
      .then((current) => {
        setScope(current);
        return load(current.propertyId, 'engagement');
      })
      .catch((value: unknown) => setError(value instanceof Error ? value.message : 'Unable to load assurance context'));
    // The initial engagement context is loaded once for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodStart = useMemo(() => {
    if (!scope) return '';
    if (period === 'engagement') return scope.auditPeriodStart.slice(0, 10);
    if (period === 'custom') return customStart;
    return periodRange(period).start;
  }, [customStart, period, scope]);

  const periodEnd = useMemo(() => {
    if (!scope) return '';
    if (period === 'engagement') return scope.auditPeriodEnd.slice(0, 10);
    if (period === 'custom') return customEnd;
    return periodRange(period).end;
  }, [customEnd, period, scope]);

  if (error && !data) {
    return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200">{error}</div>;
  }
  if (!data || !scope) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading assurance data…
      </div>
    );
  }

  const r = data.reconciliation;
  const revenueBalanced = isZero(r.revenueDifference);
  const cashBalanced = isZero(r.cashVariance);
  const posBalanced = isZero(r.posVariance);
  const closeCoverage = r.closePackages > 0 ? r.finalizedClosePackages / r.closePackages : 0;
  const balanced = revenueBalanced && cashBalanced && posBalanced;
  const snapshotExceptions = data.snapshots.filter((snapshot) => snapshot.reconciliationStatus !== 'BALANCED');

  const selectPeriod = (nextPeriod: PeriodKey) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') void load(scope.propertyId, nextPeriod);
  };

  const bridges = [
    {
      label: 'Revenue bridge',
      description: 'Folio charges against posted revenue accounts',
      left: money(r.folioCharges, data.scope.currency),
      right: money(r.postedRevenue, data.scope.currency),
      variance: r.revenueDifference,
      balanced: revenueBalanced,
    },
    {
      label: 'Cash bridge',
      description: 'Expected cash against declared cash',
      left: money(r.cashExpected, data.scope.currency),
      right: money(r.cashDeclared, data.scope.currency),
      variance: r.cashVariance,
      balanced: cashBalanced,
    },
    {
      label: 'POS settlement bridge',
      description: `${r.posSettlementCount} settlement batch${r.posSettlementCount === 1 ? '' : 'es'} in scope`,
      left: 'Settlement batches',
      right: String(r.posSettlementCount),
      variance: r.posVariance,
      balanced: posBalanced,
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-3xl border border-white/[.08] bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-300">
              <ShieldCheck className="h-4 w-4" /> External audit · assurance
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Reconciliation assurance</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Establish whether the PMS, POS, cash controls, and daily close evidence agree for the authorized review window.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[.08] bg-white/[.05] px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Authorized property</p>
            <p className="mt-1 font-semibold text-white">{scope.propertyName}</p>
            <p className="mt-1 text-xs text-slate-500">{periodStart && periodEnd ? formatPeriod(periodStart, periodEnd) : 'Select a review window'}</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4 shadow-xl shadow-black/5 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-300"><CalendarRange className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-white">Review window</p>
              <p className="text-xs text-slate-500">Stay inside the engagement scope; use a custom range for targeted testing.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[.07] bg-slate-950/40 p-1">
            {([['engagement', 'Engagement'], ['7d', 'Last 7 days'], ['mtd', 'MTD'], ['ytd', 'YTD']] as [PeriodKey, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => selectPeriod(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === key ? 'bg-emerald-300 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/[.07] hover:text-white'}`}>{label}</button>
            ))}
            <button type="button" onClick={() => setPeriod('custom')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${period === 'custom' ? 'bg-white/[.12] text-white' : 'text-slate-400 hover:bg-white/[.07] hover:text-white'}`}><SlidersHorizontal className="h-3.5 w-3.5" /> Custom</button>
          </div>
        </div>
        {period === 'custom' && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/[.06] pt-4">
            <label className="text-xs text-slate-500">From<input type="date" value={customStart} min={scope.auditPeriodStart.slice(0, 10)} max={scope.auditPeriodEnd.slice(0, 10)} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-500">To<input type="date" value={customEnd} min={scope.auditPeriodStart.slice(0, 10)} max={scope.auditPeriodEnd.slice(0, 10)} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label>
            <button type="button" disabled={!customStart || !customEnd || customStart > customEnd || loading} onClick={() => void load(scope.propertyId, 'custom')} className="rounded-lg bg-white/[.1] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Apply window</button>
          </div>
        )}
      </section>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200">{error}</div>}

      <section className={`rounded-2xl border p-5 sm:p-6 ${balanced ? 'border-emerald-300/20 bg-emerald-300/[.05]' : 'border-amber-300/20 bg-amber-300/[.05]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${balanced ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{balanced ? <BadgeCheck className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}</div>
            <div><h2 className="font-semibold text-white">{balanced ? 'Core controls reconcile' : 'Exceptions require review'}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{balanced ? 'Revenue, cash, and POS settlement comparisons are balanced for this window.' : 'At least one financial bridge contains a difference. Use evidence and close packages to establish the cause and disposition.'}</p></div>
          </div>
          {loading && <div className="inline-flex items-center gap-2 text-xs text-slate-400"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Refreshing</div>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Folio charges', money(r.folioCharges, data.scope.currency), 'Operational source total'],
          ['Posted revenue', money(r.postedRevenue, data.scope.currency), 'Revenue account total'],
          ['Cash variance', money(r.cashVariance, data.scope.currency), cashBalanced ? 'Balanced' : 'Needs explanation'],
          ['Close coverage', `${r.finalizedClosePackages}/${r.closePackages}`, closeCoverage === 1 ? 'All packages finalized' : 'Finalization incomplete'],
        ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-slate-600">{detail}</p></div>)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-violet-300" /><h2 className="font-semibold text-white">Assurance bridges</h2></div><p className="mt-1 text-xs text-slate-500">Each bridge compares a source total with its accounting or settlement counterpart.</p></div><span className="rounded-full border border-white/[.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Read only</span></div>
          <div className="space-y-3">{bridges.map((bridge) => <div key={bridge.label} className="rounded-xl border border-white/[.07] bg-slate-950/25 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{bridge.label}</p><p className="mt-1 text-xs text-slate-500">{bridge.description}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${bridge.balanced ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{bridge.balanced ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}{bridge.balanced ? 'Balanced' : 'Review'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-[11px] text-slate-600">Source</p><p className="mt-1 text-sm font-medium text-slate-200">{bridge.left}</p></div><div><p className="text-[11px] text-slate-600">Counterpart</p><p className="mt-1 text-sm font-medium text-slate-200">{bridge.right}</p></div><div><p className="text-[11px] text-slate-600">Variance</p><p className={`mt-1 text-sm font-semibold ${bridge.balanced ? 'text-emerald-300' : 'text-amber-300'}`}>{money(bridge.variance, data.scope.currency)}</p></div></div></div>)}</div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-sky-300" /><h2 className="font-semibold text-white">Close integrity</h2></div><div className="space-y-3 text-sm"><div className="flex items-center justify-between border-b border-white/[.06] pb-3"><span className="text-slate-500">Daily snapshots</span><span className="font-medium text-slate-200">{data.snapshots.length}</span></div><div className="flex items-center justify-between border-b border-white/[.06] pb-3"><span className="text-slate-500">Snapshot exceptions</span><span className={snapshotExceptions.length ? 'font-semibold text-amber-300' : 'font-medium text-emerald-300'}>{snapshotExceptions.length}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Latest close</span><span className="font-medium text-slate-200">{r.latestClose ? human(r.latestClose.status) : 'Not available'}</span></div></div>{r.latestClose?.packageHash && <p className="mt-4 break-all text-[11px] leading-5 text-slate-600">Package hash: {r.latestClose.packageHash}</p>}</section>
          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold text-white">Continue review</h2></div><p className="text-sm leading-6 text-slate-500">Use the dedicated workspaces for source evidence, report exports, and signed deliverables.</p><div className="mt-4 space-y-2"><Link href={`/external-auditor/evidence?propertyId=${scope.propertyId}`} className="flex items-center justify-between rounded-xl border border-white/[.07] p-3 text-sm text-slate-300 transition hover:bg-white/[.05]"><span>Inspect source evidence</span><ArrowUpRight className="h-4 w-4 text-slate-600" /></Link><Link href={`/external-auditor/reports?propertyId=${scope.propertyId}`} className="flex items-center justify-between rounded-xl border border-white/[.07] p-3 text-sm text-slate-300 transition hover:bg-white/[.05]"><span>Open report workspace</span><ArrowUpRight className="h-4 w-4 text-slate-600" /></Link><Link href={`/external-auditor/final-pack?propertyId=${scope.propertyId}`} className="flex items-center justify-between rounded-xl border border-white/[.07] p-3 text-sm text-slate-300 transition hover:bg-white/[.05]"><span>Review final pack</span><ArrowUpRight className="h-4 w-4 text-slate-600" /></Link></div></section>
        </aside>
      </div>
    </div>
  );
}

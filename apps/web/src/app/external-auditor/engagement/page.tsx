'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

type Scope = {
  propertyId: string;
  propertyName: string;
  currency: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  accessStartsAt: string;
  accessExpiresAt: string;
};

type Engagement = {
  id: string;
  name: string;
  auditType: string;
  status: string;
  objective?: string | null;
  scope?: string | null;
  exclusions?: string | null;
  materiality?: number | string | null;
  currency?: string | null;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  risks?: unknown;
  financialAreas?: unknown;
};

const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase());
const date = (value: string) => new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = (value: string) => new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const asList = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];

function overlapsScope(engagement: Engagement, scope: Scope) {
  return new Date(engagement.auditPeriodStart).getTime() <= new Date(scope.auditPeriodStart).getTime()
    && new Date(engagement.auditPeriodEnd).getTime() >= new Date(scope.auditPeriodEnd).getTime();
}

export default function EngagementPage() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopeIndex, setScopeIndex] = useState(0);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scope = scopes[scopeIndex];

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context')
      .then(async response => {
        const value = await response.json();
        if (!response.ok || !value.scopes?.length) throw new Error(value.error || 'No active engagement');
        setScopes(value.scopes as Scope[]);
      })
      .catch(value => setError(value instanceof Error ? value.message : 'Unable to load audit scope'));
  }, []);

  useEffect(() => {
    if (!scope) return;
    setLoading(true);
    setError('');
    setEngagement(null);
    void fetch(`/api/v1/external-auditor/management?resource=engagements&propertyId=${scope.propertyId}`)
      .then(async response => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Unable to load engagement');
        const items = (value.items || []) as Engagement[];
        const matching = items.find(item => overlapsScope(item, scope));
        if (!matching) throw new Error('No engagement record matches this authorized audit period.');
        setEngagement(matching);
      })
      .catch(value => setError(value instanceof Error ? value.message : 'Unable to load engagement'))
      .finally(() => setLoading(false));
  }, [scope]);

  const risks = useMemo(() => asList(engagement?.risks), [engagement]);
  const financialAreas = useMemo(() => asList(engagement?.financialAreas), [engagement]);
  const materiality = engagement?.materiality == null
    ? 'Not set'
    : new Intl.NumberFormat('en', { style: 'currency', currency: engagement.currency || scope?.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(engagement.materiality));
  const periodMatches = Boolean(scope && engagement && overlapsScope(engagement, scope));

  if (loading && !engagement) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading authorized engagement…</div>;
  if (error || !scope || !engagement) return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Unable to load engagement brief</p><p className="mt-1 text-sm text-red-200/80">{error || 'No engagement is available for this audit scope.'}</p></div></div></div>;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300"><ShieldCheck className="h-4 w-4" /> Audit planning record</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Engagement brief</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">The approved objective, boundary, risks, and review period for this read-only PMS audit.</p>
        </div>
        {scopes.length > 1 && <label className="text-xs text-slate-500">Authorized property<select value={scopeIndex} onChange={event => setScopeIndex(Number(event.target.value))} className="mt-1 block min-w-56 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">{scopes.map((item, index) => <option key={item.propertyId} value={index}>{item.propertyName}</option>)}</select></label>}
      </header>

      <section className="overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[.09] via-white/[.035] to-sky-300/[.05] p-5 shadow-2xl shadow-black/10 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-300">{scope.propertyName}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{engagement.name}</h2><p className="mt-2 text-sm text-slate-400">{human(engagement.auditType)} · authorized {date(scope.auditPeriodStart)} — {date(scope.auditPeriodEnd)}</p></div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><LockKeyhole className="h-3.5 w-3.5" /> Read-only scope</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Engagement status', human(engagement.status), 'text-emerald-200'],
            ['Audit period', `${date(engagement.auditPeriodStart)} – ${date(engagement.auditPeriodEnd)}`, 'text-white'],
            ['Materiality', materiality, 'text-white'],
            ['Access expires', dateTime(scope.accessExpiresAt), 'text-white'],
          ].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-white/[.08] bg-slate-950/25 p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</p><p className={`mt-2 text-sm font-semibold ${tone}`}>{value}</p></div>)}
        </div>
      </section>

      {!periodMatches && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-200">The engagement period does not fully cover the authorized access window. Review the scope before relying on engagement-level conclusions.</div>}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold text-white">Objective and boundaries</h2></div><div className="space-y-5"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Objective</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{engagement.objective || 'No objective has been recorded.'}</p></div><div className="border-t border-white/[.07] pt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Included scope</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{engagement.scope || 'No detailed scope has been recorded.'}</p></div><div className="border-t border-white/[.07] pt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Exclusions and limitations</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{engagement.exclusions || 'No exclusions have been recorded.'}</p></div></div></section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-amber-300" /><h2 className="font-semibold text-white">Risk focus</h2></div><span className="text-xs text-slate-600">{risks.length} recorded</span></div>{risks.length ? <ol className="space-y-2">{risks.map((risk, index) => <li key={`${risk}-${index}`} className="flex gap-3 rounded-xl border border-white/[.06] bg-slate-950/20 p-3 text-sm text-slate-300"><span className="font-mono text-xs text-amber-300">{String(index + 1).padStart(2, '0')}</span><span>{risk}</span></li>)}</ol> : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No engagement risks have been recorded.</p>}</section>
          <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-sky-300" /><h2 className="font-semibold text-white">Financial areas</h2></div><span className="text-xs text-slate-600">{financialAreas.length} in plan</span></div>{financialAreas.length ? <div className="flex flex-wrap gap-2">{financialAreas.map(area => <span key={area} className="rounded-full border border-sky-300/15 bg-sky-300/[.07] px-3 py-1.5 text-xs text-sky-200">{area}</span>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No financial areas have been recorded.</p>}</section>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold text-white">Continue the review</h2></div><p className="text-sm text-slate-500">Use the approved boundary above to move into source evidence, reconciliation, or deliverables.</p></div><div className="flex flex-wrap gap-2"><Link href={`/external-auditor/evidence?propertyId=${scope.propertyId}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[.06]"><FileSearch className="h-3.5 w-3.5 text-sky-300" />Evidence explorer<ArrowUpRight className="h-3.5 w-3.5 text-slate-600" /></Link><Link href={`/external-auditor/assurance?propertyId=${scope.propertyId}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-200"><CalendarRange className="h-3.5 w-3.5" />Reconciliation center<ArrowUpRight className="h-3.5 w-3.5" /></Link></div></div></section>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Loader2,
  LockKeyhole,
  Printer,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react';

type ReportKey = 'management' | 'general-ledger' | 'trial-balance' | 'revenue' | 'night-audit' | 'controls';
type PeriodKey = 'engagement' | '7d' | 'mtd' | 'ytd' | 'custom';

type Scope = {
  propertyId: string;
  propertyName?: string;
  currency?: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
};

type Report = {
  headers: string[];
  rows: unknown[][];
  scope?: Scope;
};

type ControlPreview = {
  kind: string;
  businessDate: string;
  reference: string;
  guestName: string;
  amount: number;
  source: string;
  status: string;
  reason: string;
  operator: string | null;
  approver: string;
};

type ReportDefinition = {
  key: ReportKey;
  title: string;
  description: string;
  group: string;
  source: string;
  icon: typeof BarChart3;
};

const reportDefinitions: ReportDefinition[] = [
  { key: 'management', title: 'Management report', description: 'Occupancy, ADR, RevPAR, revenue, payments, exceptions, and close status for the authorized period.', group: 'Close & operating review', source: 'PMS close and revenue records', icon: BarChart3 },
  { key: 'night-audit', title: 'Night audit summary', description: 'Daily close status, occupancy, room revenue, total revenue, and unresolved close signals.', group: 'Close & operating review', source: 'Night audit and occupancy snapshots', icon: CalendarDays },
  { key: 'general-ledger', title: 'General ledger', description: 'Posted journal activity with account, source, debit, credit, and entry lineage.', group: 'Accounting reports', source: 'Posted journal entries', icon: BookOpen },
  { key: 'trial-balance', title: 'Trial balance', description: 'Posted account balances for the selected review window.', group: 'Accounting reports', source: 'Posted ledger balances', icon: Table2 },
  { key: 'revenue', title: 'Revenue audit', description: 'Source-level revenue activity across room, F&B, tax, and other revenue accounts.', group: 'Accounting reports', source: 'Revenue journal and source records', icon: FileSpreadsheet },
  { key: 'controls', title: 'Discounts & complimentary', description: 'Concession activity with beneficiary, reason, operator, approver, and verification context.', group: 'Control schedules', source: 'Folio and complimentary registers', icon: BadgePercent },
];

const dateKey = (value: Date) => `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, '0')}-${`${value.getDate()}`.padStart(2, '0')}`;

const periodRange = (key: Exclude<PeriodKey, 'engagement' | 'custom'>) => {
  const today = new Date();
  if (key === '7d') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: dateKey(start), end: dateKey(today) };
  }
  if (key === 'mtd') return { start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: dateKey(today) };
  return { start: dateKey(new Date(today.getFullYear(), 0, 1)), end: dateKey(today) };
};

const formatPeriod = (start: string, end: string) => `${new Date(`${start}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${end}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());

export default function ExternalAuditorReports() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('engagement');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportKey | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context')
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok || !value.scopes?.[0]) throw new Error(value.error || 'No active engagement');
        setScope(value.scopes[0] as Scope);
      })
      .catch((value: unknown) => setError(value instanceof Error ? value.message : 'Unable to load authorized scope'));
  }, []);

  const selectedRange = (nextPeriod = period) => {
    if (nextPeriod === 'engagement') return { start: '', end: '' };
    if (nextPeriod === 'custom') return { start: customStart, end: customEnd };
    return periodRange(nextPeriod);
  };

  const periodStart = period === 'engagement' ? scope?.auditPeriodStart.slice(0, 10) || '' : selectedRange().start;
  const periodEnd = period === 'engagement' ? scope?.auditPeriodEnd.slice(0, 10) || '' : selectedRange().end;
  const selectedDefinition = reportDefinitions.find((item) => item.key === selectedReport);

  const reportUrl = (key: ReportKey, format: 'json' | 'csv') => {
    if (!scope) return '';
    const range = selectedRange();
    const params = new URLSearchParams({ propertyId: scope.propertyId, format });
    if (range.start) params.set(key === 'controls' ? 'dateFrom' : 'startDate', range.start);
    if (range.end) params.set(key === 'controls' ? 'dateTo' : 'endDate', range.end);
    if (key !== 'controls') params.set('kind', key);
    return key === 'controls' ? `/api/v1/external-auditor/controls?${params}` : `/api/v1/external-auditor/reports?${params}`;
  };

  const openReport = async (key: ReportKey) => {
    if (!scope) {
      setError('Reports are still loading the authorized property scope.');
      return;
    }
    const range = selectedRange();
    if (period === 'custom' && (!range.start || !range.end || range.start > range.end)) {
      setError('Choose a valid custom review window before opening a report.');
      return;
    }
    setSelectedReport(key);
    setLoading(true);
    setError('');
    try {
      const response = await fetch(reportUrl(key, 'json'));
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to generate report');
      if (key === 'controls') {
        const items = value.items as ControlPreview[];
        setReport({ scope: value.scope, headers: ['Type', 'Business date', 'Reference', 'Guest / beneficiary', 'Amount', 'Source', 'Status', 'Reason', 'Operator', 'Approver'], rows: items.map((item) => [item.kind, new Date(item.businessDate).toISOString().slice(0, 10), item.reference, item.guestName, item.amount, item.source, item.status, item.reason, item.operator, item.approver]) });
      } else {
        setReport(value as Report);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to generate report');
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => reportDefinitions.reduce<Record<string, ReportDefinition[]>>((groups, item) => { (groups[item.group] ||= []).push(item); return groups; }, {}), []);

  if (!scope && !error) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report scope…</div>;

  return <div className="space-y-6 pb-10">
    <header className="relative overflow-hidden rounded-3xl border border-white/[.09] bg-gradient-to-br from-[#173b39] via-[#172c3a] to-[#0b1422] p-6 shadow-2xl shadow-black/20 sm:p-8"><div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-emerald-300/[.06]" /><div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300"><FileText className="h-4 w-4" /> External audit · reporting</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Reports & schedules</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Generate source-backed schedules for close review, accounting tie-out, revenue testing, and concession controls within the authorized PMS window.</p></div>{scope && <div className="rounded-2xl border border-white/[.08] bg-white/[.05] px-4 py-3 text-right"><p className="text-xs text-slate-500">Authorized property</p><p className="mt-1 font-semibold text-white">{scope.propertyName || 'PMS property'}</p><p className="mt-1 text-xs text-slate-500">{periodStart && periodEnd ? formatPeriod(periodStart, periodEnd) : 'Select a review window'}</p></div>}</div></header>

    {scope && <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4 shadow-xl shadow-black/5 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-300"><CalendarRange className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-white">Report window</p><p className="text-xs text-slate-500">All schedules stay inside the authorized engagement scope.</p></div></div><div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[.07] bg-slate-950/40 p-1">{([['engagement', 'Engagement'], ['7d', 'Last 7 days'], ['mtd', 'MTD'], ['ytd', 'YTD']] as [PeriodKey, string][]).map(([key, name]) => <button type="button" key={key} onClick={() => setPeriod(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === key ? 'bg-emerald-300 text-slate-950' : 'text-slate-400 hover:bg-white/[.07] hover:text-white'}`}>{name}</button>)}<button type="button" onClick={() => setPeriod('custom')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${period === 'custom' ? 'bg-white/[.12] text-white' : 'text-slate-400 hover:bg-white/[.07] hover:text-white'}`}><SlidersHorizontal className="h-3.5 w-3.5" /> Custom</button></div></div>{period === 'custom' && <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/[.06] pt-4"><label className="text-xs text-slate-500">From<input type="date" value={customStart} min={scope.auditPeriodStart.slice(0, 10)} max={scope.auditPeriodEnd.slice(0, 10)} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-500">To<input type="date" value={customEnd} min={scope.auditPeriodStart.slice(0, 10)} max={scope.auditPeriodEnd.slice(0, 10)} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white" /></label><span className="text-xs text-slate-600">Apply the window by opening a report.</span></div>}</section>}

    {error && <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200"><FileWarning className="mt-0.5 h-4 w-4" />{error}</div>}

    <div className="space-y-6">{Object.entries(grouped).map(([group, definitions]) => <section key={group}><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">{group}</h2><p className="mt-1 text-xs text-slate-600">{group === 'Control schedules' ? 'Exception-oriented registers for discounts and complimentary activity.' : 'Read-only schedules generated from the PMS source records.'}</p></div><span className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:flex"><LockKeyhole className="h-3 w-3" /> Scoped</span></div><div className="grid gap-4 lg:grid-cols-2">{definitions.map((item) => <article key={item.key} className={`rounded-2xl border p-5 transition ${selectedReport === item.key ? 'border-emerald-300/30 bg-emerald-300/[.06]' : 'border-white/[.08] bg-white/[.035]'}`}><div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-emerald-300"><item.icon className="h-5 w-5" /></div><div className="min-w-0"><h3 className="font-semibold text-white">{item.title}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p><p className="mt-3 text-[11px] uppercase tracking-[.1em] text-slate-700">Source · {item.source}</p></div></div><div className="mt-5"><button type="button" onClick={() => void openReport(item.key)} disabled={loading || !scope} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-300 px-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-50">{loading && selectedReport === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />} Open report</button></div></article>)}</div></section>)}</div>

    <section className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">Report discipline</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Use Reports for schedules and exports, Evidence for transaction lineage, Assurance for reconciliation, and Final Pack for the controlled handover snapshot.</p></div><a href="/external-auditor/assurance" className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200">Open assurance <ArrowUpRight className="h-3.5 w-3.5" /></a></div></section>

    {report && selectedReport && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true"><div className="mx-auto flex min-h-full max-w-6xl flex-col"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">Read-only report preview</p><h2 className="mt-1 text-lg font-semibold text-white">{selectedDefinition?.title}</h2><p className="mt-1 text-xs text-slate-500">{report.rows.length.toLocaleString()} rows · {periodStart && periodEnd ? formatPeriod(periodStart, periodEnd) : 'Authorized engagement period'}</p></div><div className="flex items-center gap-2"><a href={reportUrl(selectedReport, 'csv')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/[.08]"><ArrowDownToLine className="h-4 w-4" /> Export CSV</a><button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200"><Printer className="h-4 w-4" /> Print</button><button type="button" onClick={() => { setReport(null); setSelectedReport(null); }} aria-label="Close report preview" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/[.08]"><X className="h-4 w-4" /></button></div></div><article className="mx-auto w-full max-w-[1000px] flex-1 bg-white p-6 text-slate-900 shadow-2xl sm:p-10 print:max-w-none print:shadow-none"><header className="border-b-2 border-slate-900 pb-5"><div className="flex items-start justify-between gap-6"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-emerald-700">LodgeCore PMS</p><h1 className="mt-2 text-2xl font-bold uppercase tracking-tight">{scope?.propertyName || 'Property management report'}</h1><p className="mt-1 text-sm font-medium text-slate-600">{selectedDefinition?.title}</p></div><div className="text-right text-xs text-slate-500"><p className="font-semibold uppercase tracking-[.12em] text-slate-700">External audit</p><p className="mt-1">Read-only source schedule</p><p className="mt-1">Generated {new Date().toLocaleDateString()}</p></div></div><div className="mt-5 grid grid-cols-2 gap-4 text-xs"><div><p className="uppercase tracking-[.12em] text-slate-500">Authorized period</p><p className="mt-1 font-semibold">{periodStart && periodEnd ? formatPeriod(periodStart, periodEnd) : 'Full engagement'}</p></div><div className="text-right"><p className="uppercase tracking-[.12em] text-slate-500">Rows</p><p className="mt-1 font-semibold">{report.rows.length.toLocaleString()}</p></div></div></header><div className="mt-7 overflow-x-auto"><table className="w-full border-collapse text-[10px] leading-4"><thead><tr>{report.headers.map((header) => <th key={header} className="border-b-2 border-slate-800 px-2 py-2 text-left font-bold uppercase tracking-[.08em] text-slate-700">{header}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index} className="odd:bg-slate-50">{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-slate-200 px-2 py-2 align-top text-slate-700">{cell == null || cell === '' ? '—' : typeof cell === 'number' ? cell.toLocaleString('en-NG', { maximumFractionDigits: 2 }) : String(cell)}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p className="py-16 text-center text-sm text-slate-500">No rows were returned for this authorized window.</p>}</div><footer className="mt-10 border-t border-slate-300 pt-4 text-[9px] text-slate-500"><div className="flex justify-between gap-4"><span>Generated from LodgeCore PMS source records</span><span>External auditor read-only report</span></div></footer></article></div></div>}
  </div>;
}

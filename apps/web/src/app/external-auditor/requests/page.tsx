'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FilePlus2,
  FolderOpen,
  Loader2,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';

type Scope = { propertyId: string; propertyName: string; currency: string; auditPeriodStart: string; auditPeriodEnd: string };
type Engagement = { id: string; name: string; auditType: string; status: string; auditPeriodStart: string; auditPeriodEnd: string };
type Request = { id: string; title: string; description: string; category: string; status: string; priority: string; ownerId?: string | null; dueDate?: string | null; submittedAt?: string | null; acceptedAt?: string | null; responseNote?: string | null; evidence?: unknown; attachments?: unknown; createdAt: string; updatedAt: string };

const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase());
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const overdue = (item: Request) => Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now() && !['ACCEPTED', 'CLOSED'].includes(item.status));
const tone = (value: string) => ['CRITICAL', 'HIGH'].includes(value) ? 'bg-red-300/10 text-red-200 ring-red-300/20' : ['MEDIUM', 'IN_PROGRESS', 'RETURNED'].includes(value) ? 'bg-amber-300/10 text-amber-200 ring-amber-300/20' : 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20';
const countJson = (value: unknown) => Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : value ? 1 : 0;

export default function EvidenceRequestsPage() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Request | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (propertyId: string, engagementId: string) => {
    const response = await fetch(`/api/v1/external-auditor/management?resource=requests&propertyId=${propertyId}&engagementId=${engagementId}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Unable to load evidence requests');
    setRequests(value.items || []);
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context').then(async response => {
      const value = await response.json();
      if (!response.ok || !value.scopes?.length) throw new Error(value.error || 'No active audit scope');
      const current = value.scopes[0] as Scope;
      setScope(current);
      const engagementsResponse = await fetch(`/api/v1/external-auditor/management?resource=engagements&propertyId=${current.propertyId}`);
      const engagementsValue = await engagementsResponse.json();
      if (!engagementsResponse.ok) throw new Error(engagementsValue.error || 'Unable to load engagement');
      const matching = (engagementsValue.items || []).find((item: Engagement) => new Date(item.auditPeriodStart) <= new Date(current.auditPeriodStart) && new Date(item.auditPeriodEnd) >= new Date(current.auditPeriodEnd));
      if (!matching) throw new Error('No engagement record matches this authorized audit period.');
      setEngagement(matching);
      await load(current.propertyId, matching.id);
    }).catch(value => setError(value instanceof Error ? value.message : 'Unable to load evidence requests')).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => requests.filter(item => {
    const haystack = `${item.title} ${item.description} ${item.category} ${item.priority}`.toLowerCase();
    return (filter === 'ALL' || (filter === 'OVERDUE' ? overdue(item) : item.status === filter)) && haystack.includes(query.toLowerCase());
  }), [filter, query, requests]);
  const open = requests.filter(item => !['ACCEPTED', 'CLOSED'].includes(item.status));
  const dueSoon = open.filter(item => item.dueDate && new Date(item.dueDate).getTime() <= Date.now() + 7 * 86400000);
  const accepted = requests.filter(item => item.status === 'ACCEPTED' || item.status === 'CLOSED');

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scope || !engagement) return;
    setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = { resource: 'request', propertyId: scope.propertyId, engagementId: engagement.id, organizationId: '' };
    form.forEach((value, key) => { body[key] = String(value); });
    try {
      const response = await fetch('/api/v1/external-auditor/management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to create request');
      setShowCreate(false); event.currentTarget.reset(); await load(scope.propertyId, engagement.id);
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to create request'); } finally { setSaving(false); }
  };

  const update = async (status: string) => {
    if (!selected || !scope || !engagement) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/v1/external-auditor/management', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'request', id: selected.id, status }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to update request');
      setSelected(value.value); await load(scope.propertyId, engagement.id);
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update request'); } finally { setSaving(false); }
  };

  if (error && !scope) return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200">{error}</div>;
  return <div className="space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-3xl border border-white/[.09] bg-gradient-to-br from-[#182d49] via-[#102139] to-[#0b1422] p-5 shadow-2xl shadow-black/20 sm:p-7"><div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-sky-300/[.06]" /><div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-sky-300"><ClipboardList className="h-4 w-4" /> Prepared-by-client register</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Evidence requests</h1><p className="mt-3 text-sm leading-6 text-slate-400">A controlled request list for PMS evidence. Each request stays tied to the engagement, period, owner, deadline, response, and acceptance decision.</p></div><button type="button" disabled={!engagement} onClick={() => setShowCreate(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 className="h-4 w-4" /> New request</button></div></section>
    {engagement && <section className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-300"><FolderOpen className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Active engagement</p><h2 className="mt-1 font-semibold text-white">{engagement.name}</h2><p className="mt-1 text-sm text-slate-500">{human(engagement.auditType)} · {date(engagement.auditPeriodStart)} — {date(engagement.auditPeriodEnd)}</p></div></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${tone(engagement.status)}`}>{human(engagement.status)}</span></section>}
    {error && <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total requests" value={requests.length} detail="Current engagement" icon={ClipboardList} /><Metric label="Awaiting response" value={open.length} detail={dueSoon.length ? `${dueSoon.length} due within 7 days` : 'No immediate deadlines'} icon={Clock3} danger={dueSoon.length > 0} /><Metric label="Overdue" value={requests.filter(overdue).length} detail="Requires follow-up" icon={AlertTriangle} danger={requests.some(overdue)} /><Metric label="Accepted / closed" value={accepted.length} detail="Accepted evidence outcomes" icon={CheckCircle2} /></section>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]"><div className="flex flex-col gap-3 border-b border-white/[.08] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Request register</h2><p className="mt-1 text-xs text-slate-600">Select a request to inspect its scope, status, response, and evidence trail.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search requests…" className="field w-full pl-9 sm:w-56" /></div><select value={filter} onChange={event => setFilter(event.target.value)} className="field sm:w-40"><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="SUBMITTED">Submitted</option><option value="RETURNED">Returned</option><option value="ACCEPTED">Accepted</option><option value="OVERDUE">Overdue</option></select></div></div>{loading ? <div className="flex h-56 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading request register…</div> : <div className="divide-y divide-white/[.06]">{filtered.map(item => <button key={item.id} type="button" onClick={() => setSelected(item)} className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[.035] lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><UploadCloud className="h-4 w-4 text-sky-300" /><span className="font-mono text-[11px] text-sky-300">REQ-{item.id.slice(0, 8).toUpperCase()}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${tone(item.status)}`}>{human(item.status)}</span><span className={`rounded-full border px-2 py-1 text-[10px] ${item.priority === 'HIGH' || item.priority === 'CRITICAL' ? 'border-red-300/20 text-red-200' : 'border-white/10 text-slate-500'}`}>{human(item.priority)}</span></div><h3 className="mt-2 truncate font-medium text-white">{item.title}</h3><p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-500">{item.description}</p></div><div className="flex shrink-0 items-center gap-5 text-xs"><div><p className="text-slate-600">Category</p><p className="mt-1 text-slate-300">{item.category}</p></div><div><p className="text-slate-600">Due</p><p className={overdue(item) ? 'mt-1 text-red-300' : 'mt-1 text-slate-300'}>{date(item.dueDate)}</p></div><ArrowUpRight className="h-4 w-4 text-slate-600" /></div></button>)}{!filtered.length && <Empty text={requests.length ? 'No requests match the current filter.' : 'No evidence requests have been recorded.'} />}</div>}</section>
    <p className="flex items-center gap-2 text-xs text-slate-600"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Evidence requests are tracked separately from PMS transactions. Acceptance means the request response was reviewed; it does not alter the underlying PMS record.</p>
    <p className="text-xs text-slate-600">Need testing or exceptions? <Link href="/external-auditor/operations" className="text-emerald-300 hover:text-emerald-200">Open fieldwork control center →</Link></p>

    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" onClick={() => !saving && setShowCreate(false)}><form onSubmit={create} role="dialog" aria-modal="true" aria-labelledby="request-modal-title" className="flex h-[min(90vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1625] shadow-2xl shadow-black/50" onClick={event => event.stopPropagation()}><header className="shrink-0 border-b border-white/[.08] bg-gradient-to-br from-[#172944] to-[#0d1625] px-5 py-5 sm:px-7"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-sky-300"><FilePlus2 className="h-4 w-4" /> Evidence intake</div><h2 id="request-modal-title" className="mt-2 text-xl font-semibold text-white">New evidence request</h2><p className="mt-1 text-sm text-slate-400">Define exactly what the PMS team must provide and when it is due.</p></div><button type="button" disabled={saving} onClick={() => setShowCreate(false)} aria-label="Close request form" className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/[.08] hover:text-white disabled:opacity-50"><X className="h-4 w-4" /></button></div></header><main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><div className="grid gap-3 sm:grid-cols-2"><input required name="title" placeholder="Request title" className="field" /><input name="category" placeholder="Category, e.g. POS reconciliation" className="field" /><textarea required name="description" placeholder="Describe the evidence required, including source, period, population, or sample details" className="field min-h-32 sm:col-span-2" /><select name="priority" className="field"><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option><option>LOW</option></select><input name="dueDate" type="date" className="field" /></div></main><footer className="shrink-0 border-t border-white/[.08] bg-slate-950/45 px-5 py-4 sm:px-7"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[.08] disabled:opacity-50">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create request</button></div></footer></form></div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" onClick={() => !saving && setSelected(null)}><div role="dialog" aria-modal="true" aria-labelledby="request-detail-title" className="flex h-[min(90vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1625] shadow-2xl shadow-black/50" onClick={event => event.stopPropagation()}><header className="shrink-0 border-b border-white/[.08] bg-gradient-to-br from-[#172944] to-[#0d1625] px-5 py-5 sm:px-7"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-300">Evidence request · REQ-{selected.id.slice(0, 8).toUpperCase()}</p><h2 id="request-detail-title" className="mt-2 truncate text-xl font-semibold text-white">{selected.title}</h2><p className="mt-1 text-sm text-slate-400">{selected.category} · Created {dateTime(selected.createdAt)}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close request detail" className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/[.08] hover:text-white"><X className="h-4 w-4" /></button></div></header><main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="space-y-5"><div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">What is requested</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{selected.description}</p></div><div className="grid gap-3 sm:grid-cols-2"><Detail label="Category" value={selected.category} /><Detail label="Priority" value={human(selected.priority)} /><Detail label="Owner" value={selected.ownerId || 'Not assigned'} /><Detail label="Due date" value={date(selected.dueDate)} /><Detail label="Submitted" value={dateTime(selected.submittedAt)} /><Detail label="Accepted" value={dateTime(selected.acceptedAt)} /></div>{selected.responseNote && <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Response note</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.responseNote}</p></div>}</section><aside className="space-y-5"><div className="rounded-2xl border border-sky-300/15 bg-sky-300/[.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-sky-200">Evidence state</p><p className="mt-2 text-2xl font-semibold text-white">{countJson(selected.evidence) + countJson(selected.attachments)}</p><p className="mt-1 text-xs text-slate-400">Linked evidence or attachments recorded</p></div><div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-semibold text-white">Review trail</h3></div><div className="mt-4 space-y-3 text-xs"><Trail label="Created" value={dateTime(selected.createdAt)} /><Trail label="Submitted" value={dateTime(selected.submittedAt)} /><Trail label="Accepted" value={dateTime(selected.acceptedAt)} /><Trail label="Last updated" value={dateTime(selected.updatedAt)} /></div></div></aside></div></main><footer className="shrink-0 border-t border-white/[.08] bg-slate-950/45 px-5 py-4 sm:px-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${tone(selected.status)}`}>{human(selected.status)}</span><span className="ml-2 text-xs text-slate-600">Update request state</span></div><select disabled={saving} value={selected.status} onChange={event => void update(event.target.value)} className="field w-full sm:w-52"><option>OPEN</option><option>IN_PROGRESS</option><option>SUBMITTED</option><option>RETURNED</option><option>ACCEPTED</option><option>CLOSED</option></select></div></footer></div></div>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail, danger = false }: { icon: typeof ClipboardList; label: string; value: string | number; detail: string; danger?: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? 'border-red-300/20 bg-red-300/[.05]' : 'border-white/[.08] bg-white/[.035]'}`}><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{label}</p><Icon className={`h-4 w-4 ${danger ? 'text-red-300' : 'text-emerald-300'}`} /></div><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p><p className={`mt-1 text-xs ${danger ? 'text-red-200' : 'text-slate-600'}`}>{detail}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[.07] bg-slate-950/25 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{value}</p></div>; }
function Trail({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-white/[.06] pb-2 last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><span className="text-right text-slate-300">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="p-14 text-center"><ClipboardList className="mx-auto h-7 w-7 text-slate-700" /><p className="mt-3 text-sm text-slate-500">{text}</p></div>; }

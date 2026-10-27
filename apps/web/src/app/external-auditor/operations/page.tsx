'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  Flag,
  FolderOpen,
  Loader2,
  Plus,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';

type Engagement = { id: string; name: string; propertyId: string; status: string; auditType: string; auditPeriodStart: string; auditPeriodEnd: string; materiality?: number | null };
type Request = { id: string; title: string; description: string; category: string; status: string; priority: string; dueDate?: string | null };
type Workpaper = { id: string; reference: string; title: string; controlArea: string; status: string; result?: string | null };
type Finding = { id: string; reference: string; title: string; severity: string; status: string; description: string; dueDate?: string | null };
type Tab = 'requests' | 'workpapers' | 'findings';

const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase());
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date';
const isOverdue = (value?: string | null) => Boolean(value && new Date(value).getTime() < Date.now());
const tone = (value: string) => ['CRITICAL', 'HIGH'].includes(value) ? 'bg-red-300/10 text-red-200 ring-red-300/20' : ['MEDIUM', 'IN_PROGRESS', 'MANAGEMENT_RESPONSE', 'IN_REMEDIATION'].includes(value) ? 'bg-amber-300/10 text-amber-200 ring-amber-300/20' : 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20';

export default function AuditOperationsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [propertyId, setPropertyId] = useState('');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab === 'workpapers' || initialTab === 'findings' ? initialTab : 'requests');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (id: string, engagementId?: string) => {
    setLoading(true);
    setError('');
    const params = `propertyId=${id}${engagementId ? `&engagementId=${engagementId}` : ''}`;
    try {
      const responses = await Promise.all([
        fetch(`/api/v1/external-auditor/management?resource=engagements&${params}`),
        fetch(`/api/v1/external-auditor/management?resource=requests&${params}`),
        fetch(`/api/v1/external-auditor/management?resource=workpapers&${params}`),
        fetch(`/api/v1/external-auditor/management?resource=findings&${params}`),
      ]);
      const values = await Promise.all(responses.map(response => response.json()));
      if (responses.some(response => !response.ok)) throw new Error(values.find(value => value.error)?.error || 'Unable to load audit operations');
      setEngagements(values[0].items || []);
      setRequests(values[1].items || []);
      setWorkpapers(values[2].items || []);
      setFindings(values[3].items || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load audit operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context').then(response => response.json()).then(value => {
      const scope = value.scopes?.[0];
      if (!scope) throw new Error(value.error || 'No active engagement');
      setPropertyId(scope.propertyId);
      return load(scope.propertyId);
    }).catch(value => {
      setError(value instanceof Error ? value.message : 'Unable to load audit scope');
      setLoading(false);
    });
  }, []);

  const engagement = engagements[0];
  const openRequests = requests.filter(item => !['CLOSED', 'ACCEPTED'].includes(item.status));
  const overdueRequests = openRequests.filter(item => isOverdue(item.dueDate));
  const activeWorkpapers = workpapers.filter(item => !['LOCKED', 'APPROVED'].includes(item.status));
  const openFindings = findings.filter(item => item.status !== 'CLOSED');
  const criticalFindings = openFindings.filter(item => ['CRITICAL', 'HIGH'].includes(item.severity));
  const nextDue = useMemo(() => [...openRequests.map(item => item.dueDate), ...openFindings.map(item => item.dueDate)].filter(Boolean).sort()[0], [openRequests, openFindings]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!engagement) { setError('No active audit engagement is available for this property.'); return; }
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const resource = tab === 'requests' ? 'request' : tab === 'workpapers' ? 'workpaper' : 'finding';
    const body: Record<string, string> = { resource, propertyId, organizationId: '', engagementId: engagement.id };
    form.forEach((value, key) => { body[key] = String(value); });
    try {
      const response = await fetch('/api/v1/external-auditor/management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to create record');
      setShowForm(false);
      event.currentTarget.reset();
      await load(propertyId, engagement.id);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create record');
    } finally {
      setSaving(false);
    }
  };

  const update = async (resource: string, id: string, status: string) => {
    try {
      const response = await fetch('/api/v1/external-auditor/management', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource, id, status }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Unable to update record');
      await load(propertyId, engagement?.id);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update record');
    }
  };

  if (error && !propertyId) return <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-6 text-red-200">{error}</div>;

  const tabs: Array<{ key: Tab; label: string; count: number; detail: string }> = [
    { key: 'requests', label: 'Evidence intake', count: openRequests.length, detail: 'Open requests and management responses' },
    { key: 'workpapers', label: 'Testing file', count: activeWorkpapers.length, detail: 'Prepared testing awaiting review' },
    { key: 'findings', label: 'Exceptions', count: openFindings.length, detail: 'Open findings and remediation ownership' },
  ];

  return <div className="space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-3xl border border-white/[.09] bg-gradient-to-br from-[#182d49] via-[#102139] to-[#0b1422] p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-emerald-300/[.06]" />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300"><ClipboardCheck className="h-4 w-4" /> Fieldwork control center</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Audit operations</h1><p className="mt-3 text-sm leading-6 text-slate-400">Coordinate evidence intake, testing, and exceptions for the authorized PMS review. This workspace records the audit trail; it does not replace the PMS financial close.</p></div>
        <button type="button" disabled={!engagement} onClick={() => setShowForm(value => !value)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Add fieldwork record</button>
      </div>
    </section>

    {engagement && <section className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><FolderOpen className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Current engagement</p><h2 className="mt-1 text-lg font-semibold text-white">{engagement.name}</h2><p className="mt-1 text-sm text-slate-500">{human(engagement.auditType)} · {date(engagement.auditPeriodStart)} — {date(engagement.auditPeriodEnd)}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${tone(engagement.status)}`}>{human(engagement.status)}</span>{engagement.materiality != null && <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-400">Materiality {engagement.materiality.toLocaleString()}</span>}</div></div></section>}
    {error && <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={UploadCloud} label="Open evidence requests" value={openRequests.length} detail={overdueRequests.length ? `${overdueRequests.length} overdue` : 'No overdue requests'} danger={overdueRequests.length > 0} /><Metric icon={FileCheck2} label="Testing in progress" value={activeWorkpapers.length} detail={activeWorkpapers.length ? 'Awaiting review or lock' : 'Testing file is clear'} /><Metric icon={Flag} label="Open exceptions" value={openFindings.length} detail={criticalFindings.length ? `${criticalFindings.length} high priority` : 'No high-priority findings'} danger={criticalFindings.length > 0} /><Metric icon={CalendarClock} label="Next due item" value={nextDue ? date(nextDue) : '—'} detail="Requests and findings" /> </section>

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" onClick={() => !saving && setShowForm(false)}><form onSubmit={create} role="dialog" aria-modal="true" aria-labelledby="fieldwork-modal-title" className="flex h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1625] shadow-2xl shadow-black/50" onClick={event => event.stopPropagation()}><header className="shrink-0 border-b border-white/[.08] bg-gradient-to-br from-[#172944] to-[#0d1625] px-5 py-5 sm:px-7"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300"><FilePlus2 className="h-4 w-4" /> Engagement fieldwork</div><h2 id="fieldwork-modal-title" className="mt-2 text-xl font-semibold text-white">Add {tab === 'requests' ? 'evidence request' : tab === 'workpapers' ? 'workpaper' : 'finding'}</h2><p className="mt-1 text-sm text-slate-400">Attach the record to the active engagement so its ownership and history remain traceable.</p></div><button type="button" disabled={saving} onClick={() => setShowForm(false)} aria-label="Close fieldwork form" className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[.08] hover:text-white disabled:opacity-50">Close</button></div></header><main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><div className="grid gap-3 sm:grid-cols-2">{tab === 'requests' && <><input required name="title" placeholder="Request title" className="field" /><input name="category" placeholder="Category, e.g. POS reconciliation" className="field" /><textarea required name="description" placeholder="Describe the evidence required and the business purpose" className="field min-h-24 sm:col-span-2" /><select name="priority" className="field"><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option><option>LOW</option></select><input name="dueDate" type="date" className="field" /></>}{tab === 'workpapers' && <><input required name="reference" placeholder="Reference, e.g. WP-001" className="field" /><input required name="title" placeholder="Workpaper title" className="field" /><input required name="controlArea" placeholder="Control area" className="field" /><input name="sampleSize" type="number" min="0" placeholder="Sample size" className="field" /><textarea name="objective" placeholder="Audit objective" className="field min-h-24 sm:col-span-2" /><textarea name="procedure" placeholder="Procedure performed" className="field min-h-24 sm:col-span-2" /></>}{tab === 'findings' && <><input required name="reference" placeholder="Reference, e.g. FIND-001" className="field" /><input required name="title" placeholder="Finding title" className="field" /><select name="severity" className="field"><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option><option>LOW</option></select><input name="dueDate" type="date" className="field" /><textarea required name="description" placeholder="Finding description" className="field min-h-24 sm:col-span-2" /><textarea name="recommendation" placeholder="Recommendation" className="field min-h-24 sm:col-span-2" /></>}</div></main><footer className="shrink-0 border-t border-white/[.08] bg-slate-950/45 px-5 py-4 sm:px-7"><div className="flex items-center justify-end gap-2"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[.08] disabled:opacity-50">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save record</button></div></footer></form></div>}

    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]"><div className="border-b border-white/[.08] p-3 sm:p-4"><div className="grid gap-2 md:grid-cols-3">{tabs.map(item => <button key={item.key} type="button" onClick={() => { setTab(item.key); setShowForm(false); }} className={`rounded-xl p-3 text-left transition ${tab === item.key ? 'bg-white/[.09] ring-1 ring-white/[.08]' : 'hover:bg-white/[.045]'}`}><div className="flex items-center justify-between gap-3"><span className={`text-sm font-semibold ${tab === item.key ? 'text-white' : 'text-slate-400'}`}>{item.label}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tab === item.key ? 'bg-emerald-300 text-slate-950' : 'bg-white/[.07] text-slate-500'}`}>{item.count}</span></div><p className="mt-1 text-xs text-slate-600">{item.detail}</p></button>)}</div></div>{loading ? <div className="flex h-56 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading fieldwork records…</div> : tab === 'requests' ? <RequestList items={requests} onUpdate={update} /> : tab === 'workpapers' ? <WorkpaperList items={workpapers} onUpdate={update} /> : <FindingList items={findings} onUpdate={update} />}</section>

    <p className="flex items-center gap-2 text-xs text-slate-600"><ShieldAlert className="h-3.5 w-3.5" />Operational fieldwork is separate from the PMS night-audit close. Exceptions must retain an owner, due date, evidence, and disposition.</p>
  </div>;
}

function Metric({ icon: Icon, label, value, detail, danger = false }: { icon: typeof UploadCloud; label: string; value: string | number; detail: string; danger?: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? 'border-red-300/20 bg-red-300/[.05]' : 'border-white/[.08] bg-white/[.035]'}`}><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{label}</p><Icon className={`h-4 w-4 ${danger ? 'text-red-300' : 'text-emerald-300'}`} /></div><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p><p className={`mt-1 text-xs ${danger ? 'text-red-200' : 'text-slate-600'}`}>{detail}</p></div>; }

function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select value={value} onChange={event => onChange(event.target.value)} className="field w-full sm:w-auto">{options.map(option => <option key={option}>{option}</option>)}</select>; }

function RequestList({ items, onUpdate }: { items: Request[]; onUpdate: (resource: string, id: string, status: string) => Promise<void> }) { return <div className="divide-y divide-white/[.06]">{items.map(item => <div key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><UploadCloud className="h-4 w-4 text-sky-300" /><h3 className="font-medium text-white">{item.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${tone(item.status)}`}>{human(item.status)}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-500">{human(item.priority)}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{item.description}</p><p className={`mt-2 text-xs ${isOverdue(item.dueDate) && !['CLOSED', 'ACCEPTED'].includes(item.status) ? 'text-red-300' : 'text-slate-600'}`}>{item.category} · Due {date(item.dueDate)}</p></div><StatusSelect value={item.status} options={['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'CLOSED']} onChange={value => void onUpdate('request', item.id, value)} /></div>)}{!items.length && <Empty text="No evidence requests have been recorded." />}</div>; }

function WorkpaperList({ items, onUpdate }: { items: Workpaper[]; onUpdate: (resource: string, id: string, status: string) => Promise<void> }) { return <div className="divide-y divide-white/[.06]">{items.map(item => <div key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><FileCheck2 className="h-4 w-4 text-violet-300" /><span className="font-mono text-xs text-violet-300">{item.reference}</span><h3 className="font-medium text-white">{item.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${tone(item.status)}`}>{human(item.status)}</span></div><p className="mt-2 text-sm text-slate-500">{item.controlArea}{item.result ? ` · Result: ${item.result}` : ' · Result not yet recorded'}</p></div><StatusSelect value={item.status} options={['DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED']} onChange={value => void onUpdate('workpaper', item.id, value)} /></div>)}{!items.length && <Empty text="No workpapers have been prepared." />}</div>; }

function FindingList({ items, onUpdate }: { items: Finding[]; onUpdate: (resource: string, id: string, status: string) => Promise<void> }) { return <div className="divide-y divide-white/[.06]">{items.map(item => <div key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Flag className="h-4 w-4 text-amber-300" /><span className="font-mono text-xs text-amber-300">{item.reference}</span><h3 className="font-medium text-white">{item.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${tone(item.severity)}`}>{human(item.severity)}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{item.description}</p><p className={`mt-2 text-xs ${item.status !== 'CLOSED' && isOverdue(item.dueDate) ? 'text-red-300' : 'text-slate-600'}`}>{human(item.status)} · Due {date(item.dueDate)}</p></div><StatusSelect value={item.status} options={['OPEN', 'MANAGEMENT_RESPONSE', 'IN_REMEDIATION', 'PENDING_VALIDATION', 'CLOSED']} onChange={value => void onUpdate('finding', item.id, value)} /></div>)}{!items.length && <Empty text="No findings have been recorded." />}</div>; }

function Empty({ text }: { text: string }) { return <div className="p-14 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300/60" /><p className="mt-3 text-sm text-slate-500">{text}</p></div>; }

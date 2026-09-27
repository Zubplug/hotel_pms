'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock3, Loader2, ShieldCheck } from 'lucide-react';

type Event = { id: string; action: string; resource: string; resourceId: string; userEmail?: string; userRole?: string; requestId: string; ipAddress?: string | null; createdAt: string };
const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase());

export default function ExternalAuditorAdminActivityPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void fetch('/api/v1/external-auditor/management?resource=activity').then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to load audit activity'); return value; }).then(value => setEvents(value.items || [])).catch(value => setError(value.message)).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6 pb-8"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300"><ShieldCheck className="h-4 w-4" /> External auditor governance</div><h1 className="text-3xl font-semibold tracking-tight text-white">Audit activity</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review access changes, evidence activity, exports, sign-offs, and chain-of-custody events across the organisation.</p></div>{error && <div className="rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200">{error}</div>}<section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]">{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading activity…</div> : <div className="divide-y divide-white/[.06]">{events.map(event => <div key={event.id} className="flex gap-4 p-5"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300"><Activity className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-white">{human(event.action)}</p><time className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</time></div><p className="mt-1 text-xs text-slate-500">{event.resource} · {event.resourceId} · {event.userEmail || event.userRole || 'System'}</p><p className="mt-1 font-mono text-[10px] text-slate-700">Request {event.requestId}{event.ipAddress ? ` · ${event.ipAddress}` : ''}</p></div><Clock3 className="hidden h-4 w-4 shrink-0 text-slate-700 sm:block" /></div>)}{!events.length && <div className="p-14 text-center text-sm text-slate-500">No audit activity has been recorded.</div>}</div>}</section></div>;
}

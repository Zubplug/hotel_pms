'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Clock3, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Ticket = { id: string; title?: string | null; issueDescription?: string | null; description?: string | null; status: string; priority: string; roomNumber?: string | null; requiresRoomRestriction?: boolean; createdAt: string };
const colors = ['#60a5fa', '#a78bfa', '#fbbf24', '#f97316', '#34d399', '#fb7185'];
const tooltipStyle = { background: '#0d1b2a', border: '1px solid rgba(148,163,184,.2)', borderRadius: 12, color: '#e2e8f0' };
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function Metric({ title, value, detail, icon: Icon, tone }: { title: string; value: string | number; detail: string; icon: ElementType; tone: string }) {
  return <Card className="border-white/[0.08] bg-white/[0.045] text-slate-100 shadow-2xl shadow-black/10"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

export function GeneralManagerMaintenanceDashboard() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/maintenance/tickets?propertyId=${propertyId}`);
      if (!response.ok) throw new Error('Unable to load maintenance tickets');
      const payload = await response.json();
      const source = Array.isArray(payload?.data?.tickets) ? payload.data.tickets : [];
      setTickets(source);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load maintenance tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadTickets(); }, 0);
    return () => window.clearTimeout(handle);
    // loadTickets is scoped to the selected property.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const statusData = useMemo(() => Object.entries(tickets.reduce<Record<string, number>>((result, ticket) => { result[ticket.status] = (result[ticket.status] || 0) + 1; return result; }, {})).map(([name, value]) => ({ name: label(name), value })), [tickets]);
  const priorityData = useMemo(() => Object.entries(tickets.reduce<Record<string, number>>((result, ticket) => { result[ticket.priority] = (result[ticket.priority] || 0) + 1; return result; }, {})).map(([name, value]) => ({ name: label(name), value })), [tickets]);
  const metrics = useMemo(() => ({ total: tickets.length, open: tickets.filter((ticket) => ['OPEN', 'ASSIGNED'].includes(ticket.status)).length, inProgress: tickets.filter((ticket) => ['IN_PROGRESS', 'WAITING_PARTS'].includes(ticket.status)).length, resolved: tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length, urgent: tickets.filter((ticket) => ['URGENT', 'HIGH'].includes(ticket.priority) && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)).length, roomImpact: tickets.filter((ticket) => ticket.requiresRoomRestriction || ticket.priority === 'URGENT').length }), [tickets]);

  if (propertyLoading || loading) return <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#07111f] p-6"><div className="h-40 animate-pulse rounded-3xl bg-white/[0.06]" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />)}</div><div className="h-80 animate-pulse rounded-3xl bg-white/[0.06]" /></div>;
  return <div className="min-h-full space-y-6 rounded-3xl bg-[#07111f] p-4 text-slate-100 sm:p-6">
    <section className="relative overflow-hidden rounded-3xl border border-orange-300/15 bg-gradient-to-br from-[#382719] via-[#201b25] to-[#091522] p-6 shadow-2xl shadow-black/20 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[40px] border-orange-300/[0.06]" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-orange-300"><span className="h-1.5 w-1.5 rounded-full bg-orange-300" />Management oversight</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Maintenance control</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Monitor property repairs, room-impacting issues, priority risk, and resolution progress for the assigned property.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadTickets()} className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button asChild size="sm" className="bg-orange-300 text-slate-950 hover:bg-orange-200"><Link href="/reports/maintenance">View report<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div></section>
    {error ? <Card className="border-rose-300/20 bg-rose-300/[0.06] text-slate-100"><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><ShieldAlert className="h-8 w-8 text-rose-300" /><p className="font-semibold">Maintenance data could not be loaded</p><p className="text-sm text-slate-500">{error}</p><Button variant="outline" onClick={() => void loadTickets()} className="border-white/10 bg-transparent text-slate-200">Try again</Button></CardContent></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric title="Total tickets" value={metrics.total} detail="Live property ledger" icon={Wrench} tone="bg-orange-300/10 text-orange-300" /><Metric title="Open" value={metrics.open} detail="Awaiting assignment" icon={CircleDot} tone="bg-sky-300/10 text-sky-300" /><Metric title="In progress" value={metrics.inProgress} detail="Being worked or blocked" icon={Clock3} tone="bg-amber-300/10 text-amber-300" /><Metric title="Resolved" value={metrics.resolved} detail="Closed or resolved" icon={CheckCircle2} tone="bg-emerald-300/10 text-emerald-300" /><Metric title="Priority risk" value={metrics.urgent} detail="High or urgent active" icon={AlertTriangle} tone="bg-rose-300/10 text-rose-300" /><Metric title="Room impact" value={metrics.roomImpact} detail="Restriction risk" icon={ShieldAlert} tone="bg-violet-300/10 text-violet-300" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Work-order pipeline</CardTitle><CardDescription className="text-slate-400">Live maintenance ticket distribution by status.</CardDescription></CardHeader><CardContent><div className="h-72">{statusData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}><CartesianGrid vertical={false} stroke="rgba(148,163,184,.12)" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" name="Tickets" fill="#fb923c" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart text="No maintenance tickets recorded for this property." />}</div></CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Priority exposure</CardTitle><CardDescription className="text-slate-400">Ticket mix by operational priority.</CardDescription></CardHeader><CardContent><div className="h-56">{priorityData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{priorityData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer> : <EmptyChart text="No priority data is available." />}</div><div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">{priorityData.map((item, index) => <span key={item.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{item.name} {item.value}</span>)}</div></CardContent></Card></div>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Active engineering queue</CardTitle><CardDescription className="text-slate-400">Recent tickets requiring operational awareness.</CardDescription></CardHeader><CardContent className="space-y-3">{tickets.filter((ticket) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)).slice(0, 8).map((ticket) => <Link key={ticket.id} href="/reports/maintenance" className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:border-orange-300/30 hover:bg-white/[0.06]"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-orange-300/10 p-2 text-orange-300"><Wrench className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{ticket.title || ticket.issueDescription || ticket.description || 'Maintenance issue'}</p><p className="text-xs text-slate-500">{ticket.roomNumber ? `Room ${ticket.roomNumber} · ` : ''}{label(ticket.status)}</p></div></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${ticket.priority === 'URGENT' || ticket.priority === 'HIGH' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : 'border-white/10 text-slate-400'}`}>{label(ticket.priority)}</span></Link>)}{!tickets.some((ticket) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)) && <EmptyChart text="No active engineering tickets." />}</CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Management signals</CardTitle><CardDescription className="text-slate-400">Signals derived from live maintenance tickets.</CardDescription></CardHeader><CardContent className="space-y-3">{metrics.roomImpact > 0 && <Signal icon={ShieldAlert} tone="violet" title={`${metrics.roomImpact} room-impacting issue${metrics.roomImpact === 1 ? '' : 's'}`} detail="Verify room restrictions and future reservations before the next occupancy cycle." />}{metrics.urgent > 0 && <Signal icon={AlertTriangle} tone="rose" title={`${metrics.urgent} priority issue${metrics.urgent === 1 ? '' : 's'} active`} detail="Escalate high and urgent tickets with engineering ownership and resolution targets." />}{metrics.inProgress > 0 && <Signal icon={Clock3} tone="amber" title={`${metrics.inProgress} ticket${metrics.inProgress === 1 ? '' : 's'} in execution`} detail="Review blocked work and waiting-parts items for operational impact." />}{metrics.roomImpact === 0 && metrics.urgent === 0 && metrics.inProgress === 0 && <Signal icon={CheckCircle2} tone="emerald" title="No immediate maintenance risk" detail="The live maintenance ledger has no active room-impacting or priority exposure." />}</CardContent></Card></section>
    </>}
  </div>;
}

function Signal({ icon: Icon, title, detail, tone }: { icon: ElementType; title: string; detail: string; tone: 'violet' | 'rose' | 'amber' | 'emerald' }) {
  const tones = { violet: 'bg-violet-300/10 text-violet-300', rose: 'bg-rose-300/10 text-rose-300', amber: 'bg-amber-300/10 text-amber-300', emerald: 'bg-emerald-300/10 text-emerald-300' };
  return <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><div className={`mt-0.5 rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></div><div><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></div>;
}

function EmptyChart({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">{text}</div>; }

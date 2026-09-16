'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Gauge,
  Loader2,
  LockKeyhole,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProperty } from '@/components/PropertyProvider';

type Room = {
  id: string;
  number: string;
  displayName?: string | null;
  status: string;
  housekeepingStatus?: string | null;
  maintenanceStatus?: string | null;
  roomType?: { name?: string | null; code?: string | null } | null;
  building?: { name?: string | null } | null;
  floor?: { name?: string | null; number?: number | null } | null;
};

type Analytics = {
  generatedAt: string;
  kpis: {
    roomRevenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
    occupiedRooms: number;
    availableRooms: number;
    arrivals: number;
    departures: number;
  };
  trend: Array<{ date: string; revenue: number; occupancyPct: number }>;
};

const money = (value: unknown) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function Metric({ label: title, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof BedDouble; tone: string }) {
  return <div className="rounded-2xl border border-[#dfe5ef] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div></div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#dfe5ef] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]"><div className="mb-5"><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{children}</section>;
}

export function RoomAnalysisClient() {
  const { propertyId } = useProperty();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/dashboard/analytics?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || 'Unable to load room analytics');
        return payload?.data ?? payload;
      }),
      // The room endpoint caps pageSize at 100; this is sufficient for the
      // read-only operating snapshot and keeps the request within its schema.
      fetch(`/api/v1/rooms?propertyId=${encodeURIComponent(propertyId)}&pageSize=100&sortBy=number&sortOrder=asc`, { cache: 'no-store' }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || 'Unable to load room status');
        return payload?.data ?? [];
      }),
    ]).then(([summary, roomList]) => {
      if (!active) return;
      setAnalytics(summary as Analytics);
      setRooms(roomList as Room[]);
      setError(null);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load room analysis');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [propertyId]);

  const statusGroups = useMemo(() => {
    const groups = new Map<string, number>();
    rooms.forEach((room) => groups.set(room.status, (groups.get(room.status) || 0) + 1));
    return [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count }));
  }, [rooms]);

  const roomTypeGroups = useMemo(() => {
    const groups = new Map<string, number>();
    rooms.forEach((room) => {
      const type = room.roomType?.name || 'Unassigned';
      groups.set(type, (groups.get(type) || 0) + 1);
    });
    return [...groups.entries()].sort((a, b) => b[1] - a[1]);
  }, [rooms]);

  const outOfOrder = rooms.filter((room) => ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(room.status)).length;
  const cleanReady = rooms.filter((room) => ['CLEAN', 'INSPECTED', 'AVAILABLE'].includes(room.status)).length;
  const turnover = rooms.filter((room) => ['DIRTY', 'CLEANING'].includes(room.status)).length;

  if (loading) return <div className="flex min-h-[520px] items-center justify-center bg-[#f7f9fc]"><div className="flex items-center gap-3 text-sm font-semibold text-indigo-700"><Loader2 className="h-5 w-5 animate-spin" /> Loading room analysis…</div></div>;
  if (error || !analytics) return <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || 'Room analysis is unavailable.'}<button onClick={() => window.location.reload()} className="ml-3 font-bold underline">Try again</button></div>;

  const kpis = analytics.kpis;
  const availableRooms = Math.max(0, Number(kpis.availableRooms || 0) - Number(kpis.occupiedRooms || 0));

  return <div className="min-h-full bg-[#f7f9fc] text-slate-900"><header className="border-b border-[#17233d] bg-[#0a1020] text-white"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-300"><BedDouble className="h-4 w-4" /> Cash operations · read only</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Room analysis</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">A read-only view of occupancy, room revenue, availability, and room readiness for informed cashier and finance decisions.</p></div><div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><LockKeyhole className="h-4 w-4 text-indigo-300" /><div><p className="text-xs font-bold text-white">Read-only workspace</p><p className="text-[11px] text-slate-400">No room status or reservation actions are available here</p></div></div></div></div></header>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Occupancy" value={`${Number(kpis.occupancy || 0).toFixed(1)}%`} detail={`${kpis.occupiedRooms} of ${kpis.availableRooms} sellable rooms`} icon={Gauge} tone="bg-indigo-50 text-indigo-600" /><Metric label="Room revenue" value={money(kpis.roomRevenue)} detail="Current business-date revenue" icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" /><Metric label="ADR" value={money(kpis.adr)} detail={`RevPAR ${money(kpis.revpar)}`} icon={CalendarCheck} tone="bg-violet-50 text-violet-600" /><Metric label="Sellable availability" value={String(availableRooms)} detail={`${outOfOrder} rooms unavailable`} icon={BedDouble} tone="bg-amber-50 text-amber-600" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]"><Panel title="Revenue and occupancy trend" subtitle="Authoritative business-date performance over the last 14 days"><div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.trend || []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="roomRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid stroke="#e8edf5" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => new Date(String(value)).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} /><YAxis yAxisId="revenue" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => Number(value) > 1000 ? `₦${Math.round(Number(value) / 1000)}k` : `₦${value}`} /><YAxis yAxisId="occupancy" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value: any, name: any) => name === 'Occupancy' ? [`${value}%`, name] : [money(value), 'Room revenue']} contentStyle={{ borderRadius: 12, borderColor: '#dfe5ef' }} /><Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Room revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#roomRevenueFill)" /><Area yAxisId="occupancy" type="monotone" dataKey="occupancyPct" name="Occupancy" stroke="#10b981" strokeWidth={2.5} fill="none" /></AreaChart></ResponsiveContainer></div></Panel><Panel title="Today’s room movement" subtitle="Workload that impacts cash and front-desk readiness"><div className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-blue-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-blue-900"><ArrowDownToLine className="h-4 w-4" /> Arrivals</span><strong className="text-xl text-blue-900">{kpis.arrivals}</strong></div><div className="flex items-center justify-between rounded-xl bg-violet-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-violet-900"><ArrowUpFromLine className="h-4 w-4" /> Departures</span><strong className="text-xl text-violet-900">{kpis.departures}</strong></div><div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Ready / available</span><strong className="text-xl text-emerald-900">{cleanReady}</strong></div><div className="flex items-center justify-between rounded-xl bg-amber-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Clock3 className="h-4 w-4" /> Turnover queue</span><strong className="text-xl text-amber-900">{turnover}</strong></div></div></Panel></div>
      <div className="grid gap-6 lg:grid-cols-2"><Panel title="Room status distribution" subtitle="Current room state, presented without action controls"><div className="space-y-4">{statusGroups.length ? statusGroups.map(({ status, count }) => { const percentage = rooms.length ? Math.round((count / rooms.length) * 100) : 0; const danger = ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(status); return <div key={status}><div className="mb-1.5 flex justify-between text-xs"><span className={`font-bold ${danger ? 'text-red-700' : 'text-slate-700'}`}>{label(status)}</span><span className="font-semibold text-slate-500">{count} · {percentage}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${danger ? 'bg-red-500' : status === 'OCCUPIED' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${percentage}%` }} /></div></div>; }) : <p className="py-8 text-center text-sm text-slate-500">No room status data available.</p>}</div></Panel><Panel title="Room type mix" subtitle="Inventory composition for revenue context"><div className="space-y-3">{roomTypeGroups.length ? roomTypeGroups.map(([name, count]) => <div key={name} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><BedDouble className="h-4 w-4" /></span><span className="text-sm font-semibold text-slate-700">{name}</span></div><span className="text-sm font-bold text-slate-900">{count} rooms</span></div>) : <p className="py-8 text-center text-sm text-slate-500">No room type data available.</p>}</div></Panel></div>
      <Panel title="Finance and operations readout" subtitle="Signals for reconciliation, cash forecasting, and manager escalation"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-semibold text-indigo-700">Occupancy signal</p><p className="mt-2 text-sm font-bold text-indigo-950">{Number(kpis.occupancy || 0) >= 70 ? 'Strong room utilisation' : 'Capacity remains available'}</p><p className="mt-1 text-xs text-indigo-700/80">Use occupancy with ADR and RevPAR when reviewing room cash performance.</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Revenue signal</p><p className="mt-2 text-sm font-bold text-emerald-950">{money(kpis.roomRevenue)} room revenue recorded</p><p className="mt-1 text-xs text-emerald-700/80">ADR reflects the average occupied-room value for this business date.</p></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Attention signal</p><p className="mt-2 text-sm font-bold text-amber-950">{outOfOrder ? `${outOfOrder} room${outOfOrder === 1 ? '' : 's'} unavailable` : 'No unavailable rooms reported'}</p><p className="mt-1 text-xs text-amber-700/80">Escalate inventory constraints through the rooms or maintenance team.</p></div></div></Panel>
      <p className="text-right text-xs text-slate-400">Read-only snapshot generated {new Date(analytics.generatedAt).toLocaleString('en-NG')}</p></main>
    </div>;
}

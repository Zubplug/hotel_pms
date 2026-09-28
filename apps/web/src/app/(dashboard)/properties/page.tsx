'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowRight, BedDouble, Building2, CalendarDays, CheckCircle2,
  Edit3, Layers3, MapPin, Phone, ReceiptText, RefreshCw, Users, Wrench,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useProperty } from '@/components/PropertyProvider';
import { PropertyForm, PropertyFormValues } from '@/components/properties/PropertyForm';
import { BuildingManagementDialog } from '@/components/properties/BuildingManagementDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type Property = {
  id: string;
  name: string;
  code: string;
  address?: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  buildings: Array<{ id: string; name: string; _count?: { rooms: number } }>;
  _count: { rooms: number; roomTypes: number };
};

const unwrap = <T,>(response: any, fallback: T): T => response?.data ?? fallback;
const tone = (status: string) => {
  if (['AVAILABLE', 'CLEAN', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(status)) return 'text-emerald-300';
  if (['OUT_OF_ORDER', 'CANCELLED', 'NO_SHOW', 'OVERDUE'].includes(status)) return 'text-rose-300';
  return 'text-amber-300';
};

function LoadingDashboard() {
  return <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#07111f] p-6 text-slate-200"><div className="h-8 w-72 animate-pulse rounded bg-white/10" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />)}</div><div className="grid gap-4 lg:grid-cols-3"><div className="h-80 animate-pulse rounded-2xl bg-white/[0.06] lg:col-span-2" /><div className="h-80 animate-pulse rounded-2xl bg-white/[0.06]" /></div></div>;
}

function useLiveQuery(key: string, url: string, enabled: boolean, propertyId: string) {
  return useQuery({ queryKey: ['property-command-center', propertyId, key], queryFn: async () => { const response = await fetch(url); if (!response.ok) throw new Error(`Failed to load ${key}`); return response.json(); }, enabled });
}

function Metric({ label, value, detail, icon: Icon, accent = 'emerald' }: { label: string; value: string | number; detail: string; icon: React.ElementType; accent?: string }) {
  return <Card className="border-white/[0.08] bg-white/[0.045] text-slate-100 shadow-2xl shadow-black/10"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`rounded-xl bg-${accent}-400/10 p-2.5 text-${accent}-300`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

export default function PropertiesPage() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [buildingsOpen, setBuildingsOpen] = useState(false);
  const enabled = !propertyLoading && !!propertyId;
  const propertyQuery = useLiveQuery('profile', `/api/v1/properties/${propertyId}`, enabled, propertyId);
  const roomsQuery = useLiveQuery('rooms', `/api/v1/rooms?propertyId=${propertyId}&page=1&pageSize=100`, enabled, propertyId);
  const reservationsQuery = useLiveQuery('reservations', `/api/v1/reservations?propertyId=${propertyId}&page=1&pageSize=100`, enabled, propertyId);
  const housekeepingQuery = useLiveQuery('housekeeping', `/api/v1/housekeeping/tasks?propertyId=${propertyId}`, enabled, propertyId);
  const maintenanceQuery = useLiveQuery('maintenance', `/api/v1/maintenance/tickets?propertyId=${propertyId}`, enabled, propertyId);
  const receivablesQuery = useLiveQuery('receivables', `/api/v1/reports/receivables?propertyId=${propertyId}`, enabled, propertyId);

  if (propertyLoading || (enabled && propertyQuery.isLoading)) return <LoadingDashboard />;
  const property = unwrap<Property | null>(propertyQuery.data, null);
  if (!property) return <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-8 text-rose-200">The assigned property could not be loaded.</div>;

  const rooms = unwrap<any[]>(roomsQuery.data, []);
  const reservations = unwrap<any[]>(reservationsQuery.data, []);
  const housekeeping = unwrap<any[]>(housekeepingQuery.data, []);
  const maintenance = maintenanceQuery.data?.data?.tickets ?? maintenanceQuery.data?.tickets ?? [];
  const receivables = receivablesQuery.data?.data?.receivables ?? [];
  const roomStatus = rooms.reduce((result: Record<string, number>, room: any) => { result[room.status] = (result[room.status] || 0) + 1; return result; }, {});
  const statusData = Object.entries(roomStatus).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }));
  const occupied = roomStatus.OCCUPIED || roomStatus.ASSIGNED || 0;
  const totalReceivables = receivables.reduce((sum: number, item: any) => sum + Number(item.financials?.balance || 0), 0);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const arrivals = reservations.filter((item: any) => String(item.checkIn).slice(0, 10) === todayKey).length;
  const departures = reservations.filter((item: any) => String(item.checkOut).slice(0, 10) === todayKey).length;
  const chartColors = ['#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa'];
  const refresh = () => { void Promise.all([propertyQuery.refetch(), roomsQuery.refetch(), reservationsQuery.refetch(), housekeepingQuery.refetch(), maintenanceQuery.refetch(), receivablesQuery.refetch()]); };
  const saveProperty = async (values: PropertyFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/properties/${property.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'Could not update property');
      }
      await propertyQuery.refetch();
      setEditOpen(false);
      toast.success('Property details updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update property');
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="min-h-full space-y-6 rounded-3xl bg-[#07111f] p-4 text-slate-100 sm:p-6">
    <section className="relative overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-[#112b35] via-[#0b1d2c] to-[#091522] p-6 shadow-2xl shadow-black/20 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[40px] border-emerald-300/[0.06]" />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-4 flex flex-wrap items-center gap-2"><Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />Assigned property</Badge><Badge variant="outline" className="border-white/15 text-slate-300">{property.code}</Badge></div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{property.name}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><MapPin className="h-4 w-4 text-emerald-300" />{property.city}, {property.country}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={refresh} className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" />Refresh live data</Button><Button type="button" size="sm" onClick={() => setEditOpen(true)} className="bg-emerald-300 text-slate-950 hover:bg-emerald-200"><Edit3 className="mr-2 h-4 w-4" />Edit property</Button></div></div>
    </section>

    <Dialog open={editOpen} onOpenChange={(open) => !isSaving && setEditOpen(open)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-white/10 bg-[#0d1b2a] p-0 text-slate-100 sm:max-w-3xl">
        <DialogHeader className="border-b border-white/10 px-6 py-5 pr-12">
          <DialogTitle className="text-xl text-white">Edit property details</DialogTitle>
          <DialogDescription className="text-slate-400">Update the assigned property identity, location, and contact details.</DialogDescription>
        </DialogHeader>
        <div className="px-4 py-5 sm:px-6 [&_form]:max-w-none [&_form]:space-y-4 [&_section]:border-white/10 [&_section]:bg-white/[0.03] [&_section_header]:border-white/10 [&_section_header]:bg-white/[0.03] [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-slate-100 [&_label]:text-slate-300">
          <PropertyForm defaultValues={property} mode="edit" darkTheme onSubmit={saveProperty} onCancel={() => setEditOpen(false)} isSubmitting={isSaving} />
        </div>
      </DialogContent>
    </Dialog>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Room inventory" value={property._count.rooms} detail={`${property._count.roomTypes} active room types`} icon={BedDouble} /><Metric label="Live occupancy" value={`${property._count.rooms ? Math.round((occupied / property._count.rooms) * 100) : 0}%`} detail={`${occupied} occupied / assigned rooms`} icon={Activity} accent="sky" /><Metric label="Today’s movement" value={`${arrivals + departures}`} detail={`${arrivals} arrivals · ${departures} departures`} icon={CalendarDays} accent="amber" /><Metric label="Receivables" value={formatCurrency(totalReceivables)} detail={`${receivables.length} open folios`} icon={ReceiptText} accent="rose" /></div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Room status control</CardTitle><CardDescription className="text-slate-400">Live inventory distribution from the property room ledger.</CardDescription></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}><CartesianGrid vertical={false} stroke="rgba(148,163,184,.12)" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(148,163,184,.2)', borderRadius: 12, color: '#e2e8f0' }} /><Bar dataKey="value" name="Rooms" radius={[6, 6, 0, 0]} fill="#34d399" /></BarChart></ResponsiveContainer></div></CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Inventory mix</CardTitle><CardDescription className="text-slate-400">Status mix across physical rooms.</CardDescription></CardHeader><CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{statusData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(148,163,184,.2)', borderRadius: 12, color: '#e2e8f0' }} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{statusData.slice(0, 5).map((item, index) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />{item.name}</span><span className="font-medium text-slate-200">{item.value}</span></div>)}</div></CardContent></Card></div>

    <div className="grid gap-6 lg:grid-cols-3"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100 lg:col-span-2"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Operational exceptions</CardTitle><CardDescription className="text-slate-400">Live work requiring an owner’s attention.</CardDescription></div><Badge variant="outline" className="border-white/15 text-slate-300">{housekeeping.length + maintenance.length} open items</Badge></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2"><Link href={`/housekeeping?propertyId=${property.id}`} className="group rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-5 transition hover:border-amber-300/35"><div className="flex items-center justify-between"><div className="rounded-xl bg-amber-300/10 p-2.5 text-amber-300"><CheckCircle2 className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-amber-300" /></div><p className="mt-5 text-sm text-slate-400">Housekeeping workload</p><p className={`mt-1 text-3xl font-semibold ${tone('PENDING')}`}>{housekeeping.length}</p><p className="mt-1 text-xs text-slate-500">Tasks on the live board</p></Link><Link href={`/maintenance?propertyId=${property.id}`} className="group rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-5 transition hover:border-rose-300/35"><div className="flex items-center justify-between"><div className="rounded-xl bg-rose-300/10 p-2.5 text-rose-300"><Wrench className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-rose-300" /></div><p className="mt-5 text-sm text-slate-400">Maintenance tickets</p><p className="mt-1 text-3xl font-semibold text-rose-300">{maintenance.length}</p><p className="mt-1 text-xs text-slate-500">Open work orders</p></Link></div></CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Property profile</CardTitle><CardDescription className="text-slate-400">Configuration and physical estate.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-center gap-3 text-sm text-slate-300"><Building2 className="h-4 w-4 text-emerald-300" />{property.buildings.length} buildings</div><div className="flex items-center gap-3 text-sm text-slate-300"><Layers3 className="h-4 w-4 text-emerald-300" />{property._count.roomTypes} room types</div>{property.phone && <div className="flex items-center gap-3 text-sm text-slate-400"><Phone className="h-4 w-4" />{property.phone}</div>}<Button type="button" variant="outline" onClick={() => setBuildingsOpen(true)} className="mt-3 w-full border-white/15 bg-transparent text-slate-200 hover:bg-white/10">Manage buildings<ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card></div>

    <BuildingManagementDialog propertyId={property.id} open={buildingsOpen} onOpenChange={setBuildingsOpen} />

    <Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Management shortcuts</CardTitle><CardDescription className="text-slate-400">Move from the command center into the operating module for this property.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Button asChild variant="outline" className="justify-between border-white/10 bg-transparent text-slate-300 hover:bg-white/10"><Link href={`/rooms?propertyId=${property.id}`}>Room inventory<BedDouble className="h-4 w-4" /></Link></Button><Button asChild variant="outline" className="justify-between border-white/10 bg-transparent text-slate-300 hover:bg-white/10"><Link href={`/reservations?propertyId=${property.id}`}>Reservations<CalendarDays className="h-4 w-4" /></Link></Button><Button asChild variant="outline" className="justify-between border-white/10 bg-transparent text-slate-300 hover:bg-white/10"><Link href={`/guests?propertyId=${property.id}`}>Guest profiles<Users className="h-4 w-4" /></Link></Button><Button asChild variant="outline" className="justify-between border-white/10 bg-transparent text-slate-300 hover:bg-white/10"><Link href={`/reports?propertyId=${property.id}`}>Reports & insights<Activity className="h-4 w-4" /></Link></Button></CardContent></Card>
  </div>;
}

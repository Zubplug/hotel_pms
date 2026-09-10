'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Activity, ArrowUpRight, Banknote, BarChart3, BedDouble,
  CalendarCheck, ClipboardList, CreditCard, Gauge, Hotel,
  Package, RefreshCw, Settings, ShieldAlert, TrendingUp,
  Users, Utensils, Wrench, MoonStar,
  Shirt,
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';

type Analytics = {
  generatedAt: string;
  scope: { propertyId: string; properties: Array<{ id: string; name: string; code: string }> };
  kpis: {
    revenueToday: number; roomRevenue: number; fbRevenue: number; otherRevenue: number;
    occupancy: number; adr: number; revpar: number; occupiedRooms: number; availableRooms: number;
    activeGuests: number; arrivals: number; departures: number; receivables: number;
    receivablesCount: number; pendingApprovals: number; housekeepingOpen: number;
    maintenanceOpen: number; offlineTerminals: number;
  };
  trend: Array<{ date: string; revenue: number; occupancyPct: number }>;
  properties: Array<{ id: string; name: string; code: string; occupancy: number; adr: number; revpar: number; revenue: number; outOfOrder: number; arrivals: number; departures: number; alerts: number }>;
  activity: Array<{ id: string; action: string; property: string; timeAgo: string; details?: any }>;
};

const money = (value: number) => formatCurrency(Number(value || 0), 'NGN');
const compactMoney = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));

function Kpi({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: string }) {
  return <Card className="overflow-hidden border-muted/60 shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

function ModuleLink({ href, label, detail, icon: Icon, tone }: { href: string; label: string; detail: string; icon: React.ElementType; tone: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold group-hover:text-primary">{label}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></Link>;
}

function ComingSoonModule({ label, detail, icon: Icon }: { label: string; detail: string; icon: React.ElementType }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold">{label}</p><Badge variant="outline" className="text-[10px]">Coming soon</Badge></div><p className="truncate text-xs text-muted-foreground">{detail}</p></div></div>;
}

export default function GeneralManagerDashboardPage() {
  const { data: session } = useLodgeCoreSession();
  const [propertyId, setPropertyId] = useState('ALL');
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['general-manager', 'analytics', propertyId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/dashboard/analytics${propertyId === 'ALL' ? '' : `?propertyId=${propertyId}`}`);
      if (!response.ok) throw new Error('Unable to load management analytics');
      return (await response.json()).data as Analytics;
    },
  });
  const { data: propertiesRes } = useQuery({
    queryKey: ['general-manager', 'properties'],
    queryFn: async () => (await fetch('/api/v1/properties?pageSize=100')).json(),
  });

  const properties = propertiesRes?.data || data?.scope?.properties || [];
  const firstName = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Manager';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const alertCount = data ? data.kpis.pendingApprovals + data.kpis.housekeepingOpen + data.kpis.maintenanceOpen + data.kpis.offlineTerminals : 0;
  const sortedProperties = useMemo(() => [...(data?.properties || [])].sort((a, b) => b.revenue - a.revenue), [data?.properties]);

  if (isLoading) return <LoadingState message="Preparing the management cockpit…" />;
  if (isError || !data) return <ErrorState description="Management analytics could not be loaded." action={<Button onClick={() => refetch()}>Try again</Button>} />;

  return <div className="space-y-7 pb-10">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-primary/80 p-6 text-white shadow-xl sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[30px] border-white/10" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/70"><Gauge className="h-4 w-4" /> Executive control centre <span className="h-1 w-1 rounded-full bg-emerald-400" /> Live data</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{greeting}, {firstName}</h1><p className="mt-2 max-w-xl text-sm text-white/70">A single view of revenue, rooms, people, operations, and risk across your authorized properties.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-xs font-semibold uppercase tracking-wider text-white/60">Scope</span><Select value={propertyId} onValueChange={(value) => value && setPropertyId(value)}><SelectTrigger className="w-full border-white/20 bg-white/10 text-white sm:w-[250px]"><SelectValue placeholder="All properties" /></SelectTrigger><SelectContent><SelectItem value="ALL">All properties</SelectItem>{properties.map((property: any) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={() => refetch()} className="text-white hover:bg-white/10 hover:text-white" aria-label="Refresh dashboard"><RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button></div>
      </div>
    </section>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Revenue today" value={compactMoney(data.kpis.revenueToday)} detail={`${money(data.kpis.roomRevenue)} from rooms`} icon={Banknote} tone="bg-emerald-100 text-emerald-700" />
      <Kpi label="Occupancy" value={`${data.kpis.occupancy.toFixed(1)}%`} detail={`${data.kpis.occupiedRooms} of ${data.kpis.availableRooms} sellable rooms`} icon={CalendarCheck} tone="bg-blue-100 text-blue-700" />
      <Kpi label="ADR" value={money(data.kpis.adr)} detail={`RevPAR ${money(data.kpis.revpar)}`} icon={TrendingUp} tone="bg-violet-100 text-violet-700" />
      <Kpi label="Receivables" value={compactMoney(data.kpis.receivables)} detail={`${data.kpis.receivablesCount} open folios`} icon={CreditCard} tone="bg-amber-100 text-amber-700" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
      <Card className="border-muted/60 shadow-sm"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Performance trend</CardTitle><CardDescription>Authoritative business-date revenue and occupancy for the last 14 days.</CardDescription></div><Badge variant="secondary">{propertyId === 'ALL' ? 'Portfolio' : 'Property'}</Badge></div></CardHeader><CardContent><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => new Date(String(value)).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} /><YAxis yAxisId="revenue" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => value > 1000 ? `₦${Math.round(value / 1000)}k` : `₦${value}`} /><YAxis yAxisId="occupancy" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value: any, name: any) => name === 'Revenue' ? [money(value), name] : [`${value}%`, 'Occupancy']} labelFormatter={(value) => new Date(String(value)).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} /><Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={2} /><Line yAxisId="occupancy" type="monotone" dataKey="occupancyPct" name="Occupancy" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></div></CardContent></Card>

      <Card className="border-muted/60 shadow-sm"><CardHeader><CardTitle>Today at a glance</CardTitle><CardDescription>Immediate operating workload.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-blue-50 p-3"><span className="flex items-center gap-2 text-sm font-medium text-blue-900"><CalendarCheck className="h-4 w-4" /> Arrivals</span><strong className="text-lg text-blue-900">{data.kpis.arrivals}</strong></div><div className="flex items-center justify-between rounded-xl bg-violet-50 p-3"><span className="flex items-center gap-2 text-sm font-medium text-violet-900"><Users className="h-4 w-4" /> Active guests</span><strong className="text-lg text-violet-900">{data.kpis.activeGuests}</strong></div><div className="flex items-center justify-between rounded-xl bg-amber-50 p-3"><span className="flex items-center gap-2 text-sm font-medium text-amber-900"><ClipboardList className="h-4 w-4" /> Pending approvals</span><strong className="text-lg text-amber-900">{data.kpis.pendingApprovals}</strong></div><div className="flex items-center justify-between rounded-xl bg-rose-50 p-3"><span className="flex items-center gap-2 text-sm font-medium text-rose-900"><ShieldAlert className="h-4 w-4" /> Attention items</span><strong className="text-lg text-rose-900">{alertCount}</strong></div><p className="pt-2 text-xs text-muted-foreground">Data generated {new Date(data.generatedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p></CardContent></Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card className="border-muted/60 shadow-sm"><CardHeader><div><CardTitle>Property performance</CardTitle><CardDescription>Compare occupancy, ADR, RevPAR, and revenue by property.</CardDescription></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-3">Property</th><th className="px-3 py-3">Occupancy</th><th className="px-3 py-3 text-right">ADR</th><th className="px-3 py-3 text-right">RevPAR</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">Alerts</th></tr></thead><tbody className="divide-y">{sortedProperties.map((property) => <tr key={property.id} className="group"><td className="px-3 py-4"><Link href={`/properties/${property.id}`} className="font-semibold group-hover:text-primary">{property.name}</Link><p className="text-xs text-muted-foreground">{property.code}</p></td><td className="px-3 py-4"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, property.occupancy)}%` }} /></div><span>{property.occupancy.toFixed(1)}%</span></div></td><td className="px-3 py-4 text-right font-medium">{money(property.adr)}</td><td className="px-3 py-4 text-right font-medium">{money(property.revpar)}</td><td className="px-3 py-4 text-right font-semibold">{compactMoney(property.revenue)}</td><td className="px-3 py-4 text-right">{property.alerts > 0 ? <Badge variant="destructive">{property.alerts}</Badge> : <span className="text-emerald-600">Clear</span>}</td></tr>)}</tbody></table></div></CardContent></Card>

      <Card className="border-muted/60 shadow-sm"><CardHeader><CardTitle>Management alerts</CardTitle><CardDescription>Items that may need your attention.</CardDescription></CardHeader><CardContent className="space-y-3">{data.kpis.pendingApprovals + data.kpis.housekeepingOpen + data.kpis.maintenanceOpen + data.kpis.offlineTerminals === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><ShieldAlert className="mx-auto h-7 w-7 text-emerald-600" /><p className="mt-2 font-semibold text-emerald-900">Operations are clear</p><p className="mt-1 text-xs text-emerald-700">No outstanding management alerts for this scope.</p></div> : <><Link href="/staff" className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30"><span className="flex items-center gap-2 text-sm"><ClipboardList className="h-4 w-4 text-amber-600" /> Pending approvals</span><Badge variant={data.kpis.pendingApprovals ? 'destructive' : 'secondary'}>{data.kpis.pendingApprovals}</Badge></Link><Link href="/housekeeping" className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30"><span className="flex items-center gap-2 text-sm"><BedDouble className="h-4 w-4 text-indigo-600" /> Open housekeeping</span><Badge variant={data.kpis.housekeepingOpen ? 'destructive' : 'secondary'}>{data.kpis.housekeepingOpen}</Badge></Link><Link href="/maintenance" className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30"><span className="flex items-center gap-2 text-sm"><Wrench className="h-4 w-4 text-rose-600" /> Open maintenance</span><Badge variant={data.kpis.maintenanceOpen ? 'destructive' : 'secondary'}>{data.kpis.maintenanceOpen}</Badge></Link><Link href="/sync-center" className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30"><span className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 text-sky-600" /> Offline terminals</span><Badge variant={data.kpis.offlineTerminals ? 'destructive' : 'secondary'}>{data.kpis.offlineTerminals}</Badge></Link></>}</CardContent></Card>
    </div>

    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold tracking-tight">Hotel management areas</h2><p className="text-sm text-muted-foreground">Every operating department is visible from the executive workspace.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><ModuleLink href="/properties" label="Properties" detail="Portfolio and property settings" icon={Hotel} tone="bg-blue-100 text-blue-700" /><ModuleLink href="/frontdesk" label="Front Desk" detail="Check-in, check-out, rooms, guests" icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" /><ModuleLink href="/reservations" label="Reservations" detail="Arrivals, stays, departures" icon={CalendarCheck} tone="bg-amber-100 text-amber-700" /><ModuleLink href="/rooms" label="Rooms" detail="Room status, setup, availability" icon={BedDouble} tone="bg-emerald-100 text-emerald-700" /><ModuleLink href="/cash-management" label="General Cashier" detail="Handovers, deposits, expenses" icon={Banknote} tone="bg-green-100 text-green-700" /><ModuleLink href="/fnb/dashboard" label="F&B Management" detail="Outlets, menus, orders, revenue" icon={Utensils} tone="bg-pink-100 text-pink-700" /><ModuleLink href="/fnb/orders" label="POS" detail="Outlet sales and service activity" icon={CreditCard} tone="bg-rose-100 text-rose-700" /><ModuleLink href="/inventory" label="Stock Management" detail="Stock, purchasing, transfers" icon={Package} tone="bg-orange-100 text-orange-700" /><ModuleLink href="/housekeeping" label="Housekeeping" detail="Room readiness and workload" icon={BedDouble} tone="bg-cyan-100 text-cyan-700" /><ModuleLink href="/general-manager/laundry" label="Laundry" detail="Laundry workload and service tracking" icon={Shirt} tone="bg-sky-100 text-sky-700" /><ModuleLink href="/maintenance" label="Maintenance" detail="Tickets, assets, repairs" icon={Wrench} tone="bg-red-100 text-red-700" /><ModuleLink href="/night-audit" label="Night Auditor" detail="Business-date and reconciliation controls" icon={MoonStar} tone="bg-violet-100 text-violet-700" /><ModuleLink href="/staff" label="Staff & permissions" detail="People, roles, and access" icon={Users} tone="bg-slate-100 text-slate-700" /><ModuleLink href="/reports" label="Reports & finance" detail="Operational and financial reporting" icon={BarChart3} tone="bg-blue-100 text-blue-700" /><ComingSoonModule label="Accountant" detail="Accounting controls and close-ready financial workflows" icon={BarChart3} /><ModuleLink href="/settings" label="System settings" detail="Property and system configuration" icon={Settings} tone="bg-slate-100 text-slate-700" /></div></section>

    <Card className="border-muted/60 shadow-sm"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Recent activity</CardTitle><CardDescription>Latest audit events across the selected scope.</CardDescription></div><Link href="/reports" className="text-sm font-semibold text-primary hover:underline">View reports</Link></div></CardHeader><CardContent>{data.activity.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No recent activity recorded.</p> : <div className="grid gap-3 md:grid-cols-2">{data.activity.map((event) => <div key={event.id} className="flex items-start gap-3 rounded-xl border p-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><Activity className="h-4 w-4 text-primary" /></div><div className="min-w-0"><p className="font-medium">{event.action.replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">{event.property} · {new Date(event.timeAgo).toLocaleString('en-NG')}</p></div></div>)}</div>}</CardContent></Card>
  </div>;
}

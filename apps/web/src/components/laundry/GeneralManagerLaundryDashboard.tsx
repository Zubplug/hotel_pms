'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, RefreshCw, Shirt, TriangleAlert, WashingMachine } from 'lucide-react';
import Link from 'next/link';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type LaundryOrder = { id: string; status: string; serviceType?: string | null; totalAmount?: number | string | null; currency?: string | null; createdAt: string; room?: { number?: string | null } | null; reservation?: { confirmationNumber?: string | null; primaryGuest?: { firstName?: string; lastName?: string } | null } | null; guest?: { firstName?: string; lastName?: string } | null };
const colors = ['#fbbf24', '#60a5fa', '#a78bfa', '#34d399', '#fb7185', '#94a3b8'];
const tooltipStyle = { background: '#0d1b2a', border: '1px solid rgba(148,163,184,.2)', borderRadius: 12, color: '#e2e8f0' };
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function Metric({ title, value, detail, icon: Icon, tone }: { title: string; value: string | number; detail: string; icon: ElementType; tone: string }) {
  return <Card className="border-white/[0.08] bg-white/[0.045] text-slate-100 shadow-2xl shadow-black/10"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

export function GeneralManagerLaundryDashboard() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/laundry/orders?propertyId=${propertyId}`);
      if (!response.ok) throw new Error('Unable to load laundry operations');
      const payload = await response.json();
      setOrders(Array.isArray(payload?.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load laundry operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(handle);
    // loadOrders is scoped to the currently selected property.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const statusData = useMemo(() => Object.entries(orders.reduce<Record<string, number>>((result, order) => { result[order.status] = (result[order.status] || 0) + 1; return result; }, {})).map(([name, value]) => ({ name: label(name), value })), [orders]);
  const serviceData = useMemo(() => Object.entries(orders.reduce<Record<string, number>>((result, order) => { const key = order.serviceType || 'STANDARD'; result[key] = (result[key] || 0) + 1; return result; }, {})).map(([name, value]) => ({ name: label(name), value })), [orders]);
  const metrics = useMemo(() => {
    const bookedValue = orders.reduce((total, order) => total + Number(order.totalAmount || 0), 0);
    const delivered = orders.filter((order) => order.status === 'DELIVERED');
    const deliveredValue = delivered.reduce((total, order) => total + Number(order.totalAmount || 0), 0);
    const active = orders.filter((order) => ['PENDING', 'WASHING', 'READY'].includes(order.status));
    return { total: orders.length, active: active.length, delivered: delivered.length, bookedValue, deliveredValue, average: orders.length ? bookedValue / orders.length : 0, exceptions: orders.filter((order) => ['CANCELLED', 'ISSUE', 'MAINTENANCE_REQUIRED'].includes(order.status)).length };
  }, [orders]);
  const currency = orders.find((order) => order.currency)?.currency || 'NGN';

  if (propertyLoading || loading) return <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#07111f] p-6"><div className="h-40 animate-pulse rounded-3xl bg-white/[0.06]" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />)}</div><div className="h-80 animate-pulse rounded-3xl bg-white/[0.06]" /></div>;
  return <div className="min-h-full space-y-6 rounded-3xl bg-[#07111f] p-4 text-slate-100 sm:p-6">
    <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#103344] via-[#0d2234] to-[#091522] p-6 shadow-2xl shadow-black/20 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[40px] border-cyan-300/[0.06]" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />Management oversight</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Laundry performance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Monitor guest-service demand, order flow, service value, and delivery readiness for the assigned property.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadOrders()} className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button asChild size="sm" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Link href="/general-manager/laundry/orders">Review orders<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div></section>
    {error ? <Card className="border-rose-300/20 bg-rose-300/[0.06] text-slate-100"><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><TriangleAlert className="h-8 w-8 text-rose-300" /><p className="font-semibold">Laundry data could not be loaded</p><p className="text-sm text-slate-500">{error}</p><Button variant="outline" onClick={() => void loadOrders()} className="border-white/10 bg-transparent text-slate-200">Try again</Button></CardContent></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric title="Total orders" value={metrics.total} detail="Live property ledger" icon={PackageCheck} tone="bg-cyan-300/10 text-cyan-300" /><Metric title="Active service" value={metrics.active} detail="Pending, washing, or ready" icon={WashingMachine} tone="bg-amber-300/10 text-amber-300" /><Metric title="Delivered" value={metrics.delivered} detail="Completed guest orders" icon={CheckCircle2} tone="bg-emerald-300/10 text-emerald-300" /><Metric title="Booked service value" value={money(metrics.bookedValue, currency)} detail="Order value in live data" icon={Shirt} tone="bg-sky-300/10 text-sky-300" /><Metric title="Exceptions" value={metrics.exceptions} detail="Cancelled or service issues" icon={TriangleAlert} tone="bg-rose-300/10 text-rose-300" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Service pipeline</CardTitle><CardDescription className="text-slate-400">Current order distribution across the live laundry workflow.</CardDescription></CardHeader><CardContent><div className="h-72">{statusData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}><CartesianGrid vertical={false} stroke="rgba(148,163,184,.12)" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" name="Orders" fill="#22d3ee" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart text="No laundry orders recorded for this property." />}</div></CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Service demand mix</CardTitle><CardDescription className="text-slate-400">Order volume by service type.</CardDescription></CardHeader><CardContent><div className="h-56">{serviceData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={serviceData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{serviceData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer> : <EmptyChart text="No service mix is available." />}</div><div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">{serviceData.map((item, index) => <span key={item.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{item.name} {item.value}</span>)}</div></CardContent></Card></div>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Recent service activity</CardTitle><CardDescription className="text-slate-400">Latest orders from the assigned property.</CardDescription></CardHeader><CardContent className="space-y-3">{orders.length ? orders.slice(0, 8).map((order) => { const guest = order.reservation?.primaryGuest ? `${order.reservation.primaryGuest.firstName || ''} ${order.reservation.primaryGuest.lastName || ''}`.trim() : `${order.guest?.firstName || ''} ${order.guest?.lastName || ''}`.trim() || 'Guest service order'; return <Link key={order.id} href={`/general-manager/laundry/orders`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300"><Shirt className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{guest}</p><p className="text-xs text-slate-500">{order.room?.number ? `Room ${order.room.number} · ` : ''}{order.serviceType ? label(order.serviceType) : 'Standard service'}</p></div></div><div className="shrink-0 text-right"><p className="text-xs font-medium text-slate-300">{label(order.status)}</p><p className="mt-1 text-[10px] text-slate-500">{money(order.totalAmount, order.currency || currency)}</p></div></Link> }) : <EmptyChart text="No recent service activity." />}</CardContent></Card><Card className="border-white/[0.08] bg-white/[0.045] text-slate-100"><CardHeader><CardTitle>Management signals</CardTitle><CardDescription className="text-slate-400">Operational signals derived from live orders.</CardDescription></CardHeader><CardContent className="space-y-3"><Signal icon={Clock3} title={`${metrics.active} orders in service`} detail="Review the order queue for items approaching their promised delivery window." tone="amber" /><Signal icon={CheckCircle2} title={`${metrics.delivered} delivered orders`} detail={`Delivered service value currently totals ${money(metrics.deliveredValue, currency)}.`} tone="emerald" /><Signal icon={Shirt} title={`Average order ${money(metrics.average, currency)}`} detail="Average booked service value across all returned orders." tone="cyan" />{metrics.exceptions > 0 && <Signal icon={TriangleAlert} title={`${metrics.exceptions} exception${metrics.exceptions === 1 ? '' : 's'} to review`} detail="Open the order review queue to investigate cancellations or service issues." tone="rose" />}</CardContent></Card></section>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline" className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10"><Link href="/general-manager/laundry/orders">View all orders<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10"><Link href="/general-manager/laundry/catalog">Manage catalog<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    </>}
  </div>;
}

function Signal({ icon: Icon, title, detail, tone }: { icon: ElementType; title: string; detail: string; tone: 'amber' | 'emerald' | 'cyan' | 'rose' }) {
  const tones = { amber: 'bg-amber-300/10 text-amber-300', emerald: 'bg-emerald-300/10 text-emerald-300', cyan: 'bg-cyan-300/10 text-cyan-300', rose: 'bg-rose-300/10 text-rose-300' };
  return <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><div className={`mt-0.5 rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></div><div><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></div>;
}

function EmptyChart({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">{text}</div>; }

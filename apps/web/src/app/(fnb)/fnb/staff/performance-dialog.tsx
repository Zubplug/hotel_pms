'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, Loader2, TrendingUp, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type RangeKey = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type Staff = {
  id: string;
  name: string;
  role: string;
  sales: number;
  ordersHandled: number;
  tips: number;
  voidsOnOrders: number;
  voidsAuthorized: number;
};

const money = (value: unknown, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export function StaffPerformanceDialog({ staff, propertyId, currency }: { staff: Staff; propertyId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>('DAILY');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    fetch(`/api/v1/fnb/staff/performance?propertyId=${encodeURIComponent(propertyId)}&staffId=${encodeURIComponent(staff.id)}&range=${range}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || 'Unable to load staff performance');
        return payload?.data ?? payload;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load staff performance'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, propertyId, range, staff.id]);

  const summary = data?.summary || {};
  const trend = data?.trend || [];

  return <>
    <button onClick={() => setOpen(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-bold text-orange-700 transition hover:bg-orange-100"><BarChart3 className="h-4 w-4" /> View performance detail</button>
    {open ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#24130d]/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}><div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#eadfd8] bg-[#fbf8f6] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4 bg-[#24130d] px-6 py-5 text-white"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-300"><TrendingUp className="h-4 w-4" /> Staff performance detail</div><h2 className="mt-2 text-2xl font-bold">{staff.name}</h2><p className="mt-1 text-xs text-orange-100/70">{staff.role} · performance analytics</p></div><button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 bg-white/10 p-2 text-orange-100 hover:bg-white/15" aria-label="Close performance details"><X className="h-5 w-5" /></button></div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfd8] bg-white px-6 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#927b70]">Analysis period</p><p className="mt-1 text-xs text-[#927b70]">Closed sales and all handled orders</p></div><div className="flex rounded-xl bg-[#fbf8f6] p-1">{(['DAILY', 'WEEKLY', 'MONTHLY'] as RangeKey[]).map((key) => <button key={key} onClick={() => setRange(key)} className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] ${range === key ? 'bg-[#24130d] text-white' : 'text-[#806b60] hover:bg-white'}`}>{key[0] + key.slice(1).toLowerCase()}</button>)}</div></div><div className="min-h-0 flex-1 overflow-y-auto p-6">{loading ? <div className="flex min-h-[360px] items-center justify-center text-sm font-semibold text-[#7c2d12]"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading performance…</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#927b70]">Sales</p><p className="mt-2 text-xl font-bold text-[#24130d]">{money(summary.sales, currency)}</p></div><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#927b70]">Orders handled</p><p className="mt-2 text-xl font-bold text-[#24130d]">{summary.orders || 0}</p></div><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#927b70]">Average order</p><p className="mt-2 text-xl font-bold text-[#24130d]">{money(summary.averageOrderValue, currency)}</p></div><div className="rounded-xl border border-[#eadfd8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#927b70]">Tips</p><p className="mt-2 text-xl font-bold text-emerald-700">{money(summary.tips, currency)}</p></div></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]"><section className="rounded-2xl border border-[#eadfd8] bg-white p-5"><div className="mb-4 flex items-start justify-between"><div><h3 className="text-sm font-bold text-[#24130d]">Performance trend</h3><p className="mt-1 text-xs text-[#927b70]">Daily sales over the selected period</p></div><BarChart3 className="h-5 w-5 text-orange-500" /></div><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id={`staffSales-${staff.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.32} /><stop offset="100%" stopColor="#f97316" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid stroke="#f1e7e1" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#927b70', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => range === 'DAILY' ? 'Today' : new Date(String(value)).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} /><YAxis tick={{ fill: '#927b70', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => Number(value) > 1000 ? `₦${Math.round(Number(value) / 1000)}k` : `₦${value}`} /><Tooltip formatter={(value: any) => [money(value, currency), 'Sales']} contentStyle={{ borderRadius: 12, borderColor: '#eadfd8' }} /><Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2.5} fill={`url(#staffSales-${staff.id})`} /></AreaChart></ResponsiveContainer></div></section><section className="rounded-2xl border border-[#eadfd8] bg-white p-5"><h3 className="text-sm font-bold text-[#24130d]">Control signals</h3><p className="mt-1 text-xs text-[#927b70]">Activity that supports manager review</p><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-[#fff7ed] p-3"><span className="flex items-center gap-2 text-xs font-semibold text-orange-800"><Clock3 className="h-4 w-4" /> Closed orders</span><strong className="text-orange-950">{summary.closedOrders || 0}</strong></div><div className="flex items-center justify-between rounded-xl bg-red-50 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-red-800"><AlertTriangle className="h-4 w-4" /> Voids on orders</span><strong className="text-red-950">{summary.voidsOnOrders || 0}</strong></div><div className="flex items-center justify-between rounded-xl bg-amber-50 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Voids authorized</span><strong className="text-amber-950">{summary.voidsAuthorized || 0}</strong></div><div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> {summary.covers || 0} covers served in this period</div></div></section></div></>}</div><div className="flex justify-end border-t border-[#eadfd8] bg-white px-6 py-4"><button onClick={() => setOpen(false)} className="rounded-xl border border-[#ddcec5] px-4 py-2.5 text-sm font-bold text-[#735c51] hover:bg-[#fbf8f6]">Close</button></div></div></div> : null}
  </>;
}

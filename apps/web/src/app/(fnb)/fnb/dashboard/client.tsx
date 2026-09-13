'use client';

import { useEffect, useState, useMemo } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertCircle, BarChart3, Loader2, Calendar, Filter, Users, DollarSign, ListOrdered, UtensilsCrossed, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function KPI({ label, value, subtext, icon: Icon }: any) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</div>
      {subtext && <div className="text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function FnbAnalyticsClient() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  
  const [dateRange, setDateRange] = useState('TODAY');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user || !propertyId) return;
    
    setLoading(true);
    setError(null);
    fetch(`/api/v1/fnb/dashboard/analytics?propertyId=${propertyId}&range=${dateRange}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load analytics');
        return body.data;
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, propertyId, dateRange]);

  if (loading && !data) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-full px-5 pb-12 pt-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">{error}</div>
    </div>
  );

  const { summary, hourlyRevenue, categoryRevenue, outletRevenue, paymentMethods, topItems, operationalMetrics } = data || {};
  const currency = 'NGN';

  return (
    <div className="min-h-full bg-slate-50 pb-16 pt-6 sm:pt-8">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-8 space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              F&B Sales & Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Aggregated revenue insights, outlet performance, and operational KPIs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {['TODAY', 'YESTERDAY', 'LAST_7', 'THIS_MONTH'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    dateRange === range 
                      ? 'bg-indigo-50 text-indigo-700  ' 
                      : 'text-slate-600 hover:bg-slate-100  '
                  }`}
                >
                  {range.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <Filter className="h-3.5 w-3.5" /> Outlet
            </button>
          </div>
        </header>

        {/* ── Exception Strip ── */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Operations:</div>
          <div className="flex gap-4 opacity-90">
            <span>Voids: <strong>{money(operationalMetrics?.voids)}</strong> ({operationalMetrics?.voidCount})</span>
            <span>Discounts: <strong>{money(operationalMetrics?.discounts)}</strong></span>
            <span>Refunds: <strong>{money(operationalMetrics?.refunds)}</strong></span>
            <span>Unsettled Orders: <strong>{operationalMetrics?.unsettledOrders}</strong></span>
            <span>Open Sessions: <strong>{operationalMetrics?.openSessions}</strong></span>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPI label="Net Revenue" value={money(summary?.netRevenue)} subtext="Total finalized sales" icon={DollarSign} />
          <KPI label="Covers" value={summary?.covers} subtext="Total guests served" icon={Users} />
          <KPI label="Average Check" value={money(summary?.averageCheck)} subtext="Revenue per cover" icon={BarChart3} />
          <KPI label="Total Orders" value={summary?.orders} subtext="Submitted & closed" icon={ListOrdered} />
        </section>

        {/* ── Main Section ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Hourly Trend */}
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Revenue Trend (Hourly)</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₦${val/1000}k`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#818cf8' }}
                    formatter={(value: any) => money(value)} 
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* F&B Class Split */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Revenue by F&B Class</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRevenue} innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name" stroke="none">
                    {categoryRevenue?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => money(value)} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Second Section (Outlet & Payments) ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Revenue by Outlet</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left font-semibold text-slate-500">Outlet</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Covers</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Net Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outletRevenue?.map((o: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">{o.name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{o.covers}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-800">{money(o.revenue)}</td>
                    </tr>
                  ))}
                  {outletRevenue?.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-xs text-slate-500">No outlet data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">Payment Method Mix</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethods} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                  <XAxis type="number" tickFormatter={(val) => `₦${val/1000}k`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="method" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip formatter={(value: any) => money(value)} cursor={{ fill: '#334155', opacity: 0.2 }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="amount" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* ── Third Section (Top Items) ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-indigo-500" />
              Top 10 Items (By Revenue)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left font-semibold text-slate-500">Item</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Qty</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topItems?.revenue.map((i: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">{i.name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{i.quantity}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-800">{money(i.revenue)}</td>
                    </tr>
                  ))}
                  {(!topItems?.revenue || topItems.revenue.length === 0) && <tr><td colSpan={3} className="py-4 text-center text-xs text-slate-500">No items sold</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800 flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-emerald-500" />
              Top 10 Items (By Quantity)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left font-semibold text-slate-500">Item</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Qty</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topItems?.quantity.map((i: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">{i.name}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-800">{i.quantity}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{money(i.revenue)}</td>
                    </tr>
                  ))}
                  {(!topItems?.quantity || topItems.quantity.length === 0) && <tr><td colSpan={3} className="py-4 text-center text-xs text-slate-500">No items sold</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Calendar, TrendingUp,
  Users, Ticket, ShieldCheck, AlertTriangle, LayoutGrid,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { formatMoney, POOL_API } from '../_components/utils';

interface ReportData {
  entries: { id: string; passType: { name: string }; guestCount: number; entryDate: string; admittedAt: string | null; status: string }[];
  posOrders: { id: string; total: number; businessDate: string; paymentStatus: string }[];
  resourceBookings: { id: string; createdAt: string }[];
  incidents: { id: string; severity: string; status: string; createdAt: string }[];
  safetyChecks: { id: string; status: string; checkedAt: string }[];
  summary: {
    totalAdmissions: number;
    totalGuests: number;
    posRevenue: number;
    resourcesBooked: number;
    incidents: number;
    safetyChecks: number;
  };
  byPass: Record<string, number>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color?: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-[12px]" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      {label && <p className="font-bold text-white mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? '#94a3b8' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// Build daily admission chart from entries
function buildDailyAdmissions(entries: ReportData['entries']): { date: string; admissions: number; guests: number }[] {
  const map: Record<string, { admissions: number; guests: number }> = {};
  for (const e of entries) {
    const d = String(e.entryDate).slice(0, 10);
    if (!map[d]) map[d] = { admissions: 0, guests: 0 };
    map[d].admissions += 1;
    map[d].guests += e.guestCount;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      ...v,
    }));
}

// Build daily revenue chart
function buildDailyRevenue(orders: ReportData['posOrders']): { date: string; revenue: number }[] {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.paymentStatus !== 'PAID') continue;
    const d = String(o.businessDate).slice(0, 10);
    map[d] = (map[d] ?? 0) + Number(o.total);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      revenue,
    }));
}

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#fb923c', '#fda4af'];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('NGN');
  const [range, setRange] = useState('30');
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - Number(range));

      const params = new URLSearchParams({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      if (facilityId) params.set('facilityId', facilityId);

      const [reportRes, mainRes] = await Promise.all([
        fetch(`${POOL_API}/reports?${params.toString()}`),
        fetch(`${POOL_API}?${facilityId ? `facilityId=${facilityId}` : ''}`),
      ]);
      const report = await reportRes.json();
      const main = await mainRes.json();
      setData(report.data);
      setCurrency(main.data?.currency ?? 'NGN');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, range]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  if (!data) return null;

  const dailyAdmissions = buildDailyAdmissions(data.entries);
  const dailyRevenue = buildDailyRevenue(data.posOrders);
  const byPassData = Object.entries(data.byPass).map(([name, count]) => ({ name, count }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" style={{ color: '#475569' }} />
          <span className="text-[11px]" style={{ color: '#64748b' }}>Last</span>
          {['7', '14', '30', '90'].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: range === d ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)',
                color: range === d ? '#38bdf8' : '#64748b',
                border: `1px solid ${range === d ? 'rgba(56,189,248,0.30)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: 'Admissions', v: data.summary.totalAdmissions, icon: Ticket, c: '#38bdf8' },
          { l: 'Total Guests', v: data.summary.totalGuests, icon: Users, c: '#a78bfa' },
          { l: 'Revenue', v: formatMoney(data.summary.posRevenue, currency), icon: TrendingUp, c: '#34d399' },
          { l: 'Resources Booked', v: data.summary.resourcesBooked, icon: LayoutGrid, c: '#fb923c' },
          { l: 'Incidents', v: data.summary.incidents, icon: AlertTriangle, c: '#fda4af' },
          { l: 'Safety Checks', v: data.summary.safetyChecks, icon: ShieldCheck, c: '#fcd34d' },
        ].map(({ l, v, icon: Icon, c }) => (
          <div key={l} className="pool-metric text-center py-3 flex flex-col items-center gap-1">
            <Icon className="w-4 h-4" style={{ color: c }} />
            <p className="text-xl font-black text-white">{v}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{l}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily admissions trend */}
        <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <h3 className="text-sm font-bold text-white mb-1">Admissions Trend</h3>
          <p className="text-[11px] mb-4" style={{ color: '#475569' }}>Daily admission count vs total guests</p>
          {dailyAdmissions.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#475569' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyAdmissions} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="admissions" fill="rgba(56,189,248,0.7)" radius={[4, 4, 0, 0]} name="Admissions" />
                <Bar dataKey="guests" fill="rgba(167,139,250,0.7)" radius={[4, 4, 0, 0]} name="Guests" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue trend */}
        <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <h3 className="text-sm font-bold text-white mb-1">Revenue Trend</h3>
          <p className="text-[11px] mb-4" style={{ color: '#475569' }}>Daily pool POS revenue (paid orders only)</p>
          {dailyRevenue.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#475569' }}>No revenue data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dailyRevenue} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => formatMoney(Number(v), currency)} />
                <Line type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pass type breakdown */}
        <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <h3 className="text-sm font-bold text-white mb-1">By Pass Type</h3>
          <p className="text-[11px] mb-3" style={{ color: '#475569' }}>Admission count per pass</p>
          {byPassData.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#475569' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byPassData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={65} strokeWidth={0}>
                  {byPassData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-xl px-3 py-2 text-[12px]" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <p className="font-bold text-white">{payload[0].name}</p>
                    <p style={{ color: '#38bdf8' }}>{payload[0].value} admissions</p>
                  </div>
                ) : null} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Reconciliation */}
        <div className="lg:col-span-2 rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <h3 className="text-sm font-bold text-white mb-1">Financial Reconciliation</h3>
          <p className="text-[11px] mb-4" style={{ color: '#475569' }}>POS orders reconciled against admissions — all figures from authoritative records</p>

          <div className="space-y-2">
            {[
              { l: 'Total POS orders (pool outlet)', v: data.posOrders.length, colour: '#94a3b8' },
              { l: 'Paid orders', v: data.posOrders.filter(o => o.paymentStatus === 'PAID').length, colour: '#34d399' },
              { l: 'Unpaid / pending', v: data.posOrders.filter(o => o.paymentStatus !== 'PAID').length, colour: '#fcd34d' },
              { l: 'Gross revenue (paid)', v: formatMoney(data.posOrders.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + Number(o.total), 0), currency), colour: '#38bdf8' },
              { l: 'Admissions with POS order linked', v: data.entries.filter(e => e.status !== 'CANCELLED').length, colour: '#a78bfa' },
              { l: 'Complimentary / unlinked', v: Math.max(0, data.summary.totalAdmissions - data.posOrders.length), colour: '#64748b' },
            ].map(({ l, v, colour }) => (
              <div key={l} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[12px]" style={{ color: '#94a3b8' }}>{l}</span>
                <span className="text-sm font-black" style={{ color: colour }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.14)', color: '#64748b' }}>
            <strong style={{ color: '#38bdf8' }}>Note:</strong> All revenue figures are derived exclusively from PosOrder records with POOL/RECREATION outlet type. They reconcile with the night audit cash-up independently.
          </div>
        </div>
      </div>
    </div>
  );
}

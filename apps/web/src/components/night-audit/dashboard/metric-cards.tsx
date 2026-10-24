'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  TrendingUp, Banknote, Users, ArrowUpRight, ArrowDownRight,
  Minus, BedDouble, CalendarDays, CreditCard, Tag, Percent,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';
import { Panel, PanelHeader, cx, money, Delta, TONE_HEX } from './ui';

const DEPT_COLORS = ['#818cf8', '#fbbf24', '#fb923c', '#38bdf8', '#ec4899', '#14b8a6', '#a78bfa', '#34d399', '#f43f5e'];
const dKey = (n: string) => `d_${n.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

function revenueBreakdown(audit: any) {
  const fb = audit?.financialSnapshot || {};
  const rows = audit?.closePackage?.controlSummary?.departmentReconciliation;
  if (!Array.isArray(rows)) {
    const vals = { roomRevenue: Number(fb.roomRevenue || 0), fnbRevenue: Number(fb.fnbRevenue || 0), otherRevenue: Number(fb.otherRevenue || 0) };
    return {
      ...vals,
      departments: [
        { name: 'Rooms', value: vals.roomRevenue, key: dKey('Rooms'), color: DEPT_COLORS[0] },
        { name: 'F&B / POS', value: vals.fnbRevenue, key: dKey('F&B / POS'), color: DEPT_COLORS[1] },
        { name: 'Other', value: vals.otherRevenue, key: dKey('Other'), color: DEPT_COLORS[7] },
      ].filter((d) => d.value > 0),
    };
  }
  const valueOf = (dep: string) => Number(rows.find((r: any) => r.department === dep)?.source || 0);
  const departments = rows
    .filter((r: any) => r.department !== 'Taxes' && Number(r.source || 0) > 0)
    .map((r: any, i: number) => ({ name: String(r.department), value: Number(r.source || 0), key: dKey(String(r.department)), color: DEPT_COLORS[i % DEPT_COLORS.length] }));
  return { roomRevenue: valueOf('Rooms'), fnbRevenue: valueOf('F&B/POS'), otherRevenue: valueOf('Other'), departments };
}

const DarkTip = ({ active, payload, label, cur }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#06090f]/98 px-3 py-2.5 shadow-2xl text-[11px]">
      <p className="mb-2 font-semibold text-slate-400">{label}</p>
      {payload.filter((e: any) => e.value > 0).map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-slate-300"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: e.color }} />{e.name}</span>
          <span className="font-mono font-bold tabular-nums text-white">{money(e.value, cur)}</span>
        </div>
      ))}
    </div>
  );
};

const DonutTip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#06090f]/98 px-2.5 py-2 text-[11px]">
      <p className="font-bold text-white">{payload[0].name}</p>
      <p className="text-slate-400">{payload[0].payload.pct?.toFixed(1)}%</p>
    </div>
  );
};

interface CardProps { label: string; value: string; sub?: string; trend?: number; icon: React.ElementType; color?: string }
function MetricCard({ label, value, sub, trend, icon: Icon, color = '#818cf8' }: CardProps) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-[15px] font-bold tabular-nums text-white">{value}</p>
        {sub && <p className="mt-0.5 text-[10.5px] text-slate-500">{sub}</p>}
        {trend !== undefined && <Delta value={trend} />}
      </div>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />
    </div>
  );
}

export function MetricCards({ data }: { data: NightAuditData }) {
  const cur = data.property.baseCurrency;
  const snap = data.financialSnapshot || data.currentAudit?.financialSnapshot;
  const trend = data.analytics.trend || [];
  const last = trend[trend.length - 1] || null;
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;

  const revenue = last ? Number(last.totalRevenue) : data.analytics.revenue || 0;
  const adr = last ? Number(last.adr) : 0;
  const revpar = last ? Number(last.revpar) : 0;
  const totalRooms = data.analytics.rooms?.total || 0;
  const occupied = last ? Math.round((Number(last.occupancy) / 100) * totalRooms) : data.analytics.rooms?.occupied || 0;
  const payments = data.analytics.payments || 0;
  const openSessions = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0);

  const trendDelta = (a: number, b: number | null) => (b && b > 0 ? ((a - b) / b) * 100 : undefined);

  const prevRev = prev ? Number(prev.totalRevenue) : null;
  const prevAdr = prev ? Number(prev.adr) : null;
  const prevRevpar = prev ? Number(prev.revpar) : null;
  const prevRevenue = prev ? Number(prev.totalRevenue) : 0;

  const chartData = trend.map((t) => {
    const d = new Date(t.businessDate);
    const bd = revenueBreakdown(t);
    return { date: isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), ...Object.fromEntries(bd.departments.map((dep) => [dep.key, dep.value])), departments: bd.departments };
  });

  const curRevenue = revenueBreakdown({ financialSnapshot: snap || last?.financialSnapshot, closePackage: data.currentAudit?.closePackage || last?.closePackage });
  const deptSeries = Array.from(new Map([...chartData.flatMap((d: any) => d.departments || []), ...curRevenue.departments].map((dep: any) => [dep.key, dep])).values());
  const donutData = curRevenue.departments.map((d) => ({ ...d, pct: curRevenue.departments.reduce((s, x) => s + x.value, 0) > 0 ? (d.value / curRevenue.departments.reduce((s, x) => s + x.value, 0)) * 100 : 0 }));

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader icon={TrendingUp} title="Revenue Analytics" subtitle="Gross revenue — last audit" tone="indigo"
          actions={<span className="font-mono text-[13px] font-bold text-white">{money(revenue, cur)}</span>}
        />

        <div className="grid grid-cols-[auto_1fr] gap-px bg-white/[0.04]">
          {/* Donut */}
          {donutData.length > 0 && (
            <div className="flex items-center gap-3 bg-[#0b111e] px-4 py-3">
              <PieChart width={96} height={96}>
                <Pie data={donutData} cx={44} cy={44} innerRadius={28} outerRadius={44} paddingAngle={2} dataKey="value">
                  {donutData.map((_, i) => <Cell key={i} fill={donutData[i].color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<DonutTip />} />
              </PieChart>
              <div className="space-y-1">
                {donutData.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                    <span className="text-[10.5px] text-slate-400">{d.name}</span>
                    <span className="ml-auto pl-2 font-mono text-[10.5px] font-semibold tabular-nums text-slate-300">{d.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7-day stacked bar */}
          <div className="bg-[#0b111e] px-3 py-3" style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} dy={5} />
                <YAxis hide domain={[0, 'dataMax + (dataMax * 0.15)']} />
                <Tooltip content={<DarkTip cur={cur} />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                {deptSeries.map((s: any, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color}
                    radius={i === deptSeries.length - 1 ? [3, 3, 0, 0] : i === 0 ? [0, 0, 3, 3] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard label="Room Revenue" value={money(curRevenue.roomRevenue, cur, true)} sub={money(curRevenue.roomRevenue, cur)} icon={BedDouble} color={TONE_HEX.indigo} />
        <MetricCard label="F&B / POS" value={money(curRevenue.fnbRevenue, cur, true)} sub="Food & beverage" icon={Banknote} color={TONE_HEX.amber} />
        {curRevenue.departments.filter((d) => d.name !== 'Rooms' && d.name !== 'F&B/POS' && d.name !== 'F&B / POS').map((d) => (
          <MetricCard key={d.key} label={d.name} value={money(d.value, cur, true)} sub="Revenue dept" icon={TrendingUp} color={d.color} />
        ))}
        <MetricCard label="Taxes" value={money(snap?.taxes ?? (last?.financialSnapshot ? Number(last.financialSnapshot.taxes) : 0), cur, true)} sub="Posted taxes" icon={Percent} color="#64748b" />
        <MetricCard label="Prior Audit" value={money(prevRevenue, cur, true)} sub="Day before last" icon={CalendarDays} color="#64748b" />
        <MetricCard label="Payments" value={money(payments, cur, true)} sub="Captured today" icon={CreditCard} color={TONE_HEX.indigo} />
        <MetricCard label="Refunds" value={money(snap?.refunds ?? 0, cur, true)} sub="Posted refunds" icon={ArrowDownRight} color={TONE_HEX.rose} />
        <MetricCard label="Discounts" value={money(snap?.discounts ?? 0, cur, true)} sub="Applied" icon={Tag} color={TONE_HEX.amber} />
        <MetricCard label="ADR" value={money(adr, cur, true)} sub={`${occupied} occ rooms`} trend={trendDelta(adr, prevAdr)} icon={TrendingUp} color={TONE_HEX.violet} />
        <MetricCard label="RevPAR" value={money(revpar, cur, true)} sub={`${totalRooms} total rms`} trend={trendDelta(revpar, prevRevpar)} icon={BedDouble} color={TONE_HEX.sky} />
        <MetricCard label="In-house" value={String(data.analytics.inHouseGuests)} sub={`${openSessions} open sessions`} icon={Users} color={TONE_HEX.indigo} />
      </div>
    </div>
  );
}

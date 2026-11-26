'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  TrendingUp, Banknote, Users, ArrowDownRight,
  BedDouble, CalendarDays, CreditCard, Tag, Percent,
  ArrowUpRight, ExternalLink,
} from 'lucide-react';
import {
  PieChart, Pie, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Link from 'next/link';
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

const DonutTip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#06090f]/98 px-2.5 py-2 text-[11px]">
      <p className="font-bold text-white">{payload[0].name}</p>
      <p className="text-slate-400">{payload[0].payload.pct?.toFixed(1)}%</p>
    </div>
  );
};

interface MetricTileProps { label: string; value: string; sub?: string; trend?: number; icon: React.ElementType; color?: string }
function MetricTile({ label, value, sub, trend, icon: Icon, color = '#818cf8' }: MetricTileProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-3 transition-all hover:scale-[1.01]"
      style={{
        background: 'rgba(7,15,30,0.85)',
        borderColor: 'rgba(255,255,255,0.08)',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.6), 0 0 32px -16px ${color}20`,
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-20"
        style={{ background: `radial-gradient(ellipse 60% 60% at 80% 20%, ${color}20, transparent)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: `${color}18` }}>
            <Icon className="h-3 w-3" style={{ color }} />
          </span>
        </div>
        <p className="font-mono text-[14px] font-bold tabular-nums leading-none text-white">{value}</p>
        {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
        {trend !== undefined && <div className="mt-1"><Delta value={trend} /></div>}
      </div>
    </div>
  );
}

type AccountingRevenueDepartment = { accountCode?: string; accountName: string; today: number };

export function MetricCards({ data, accountingDepartments = [] }: { data: NightAuditData; accountingDepartments?: AccountingRevenueDepartment[] }) {
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

  const trendDelta = (a: number, b: number | null) => (b && b > 0 ? ((a - b) / b) * 100 : undefined);
  const prevAdr = prev ? Number(prev.adr) : null;
  const prevRevpar = prev ? Number(prev.revpar) : null;
  const prevRevenue = prev ? Number(prev.totalRevenue) : 0;

  const curRevenue = revenueBreakdown({ financialSnapshot: snap || last?.financialSnapshot, closePackage: data.currentAudit?.closePackage || last?.closePackage });
  const donutData = curRevenue.departments.map((d) => ({
    ...d,
    pct: curRevenue.departments.reduce((s, x) => s + x.value, 0) > 0
      ? (d.value / curRevenue.departments.reduce((s, x) => s + x.value, 0)) * 100
      : 0,
  }));

  const isEventDepartment = (name: string) => /^(event|events\s*[·-])/i.test(name);
  const eventDepartments = curRevenue.departments.filter((d) => isEventDepartment(d.name));
  const accountingEventDepartments = accountingDepartments.filter((d) => /event|banquet|hall/i.test(d.accountName));
  const eventRevenue = accountingEventDepartments.length > 0
    ? accountingEventDepartments.reduce((sum, d) => sum + Number(d.today || 0), 0)
    : eventDepartments.reduce((sum, d) => sum + d.value, 0);

  const totalDonutValue = donutData.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-3">
      {/* Revenue Snapshot Panel */}
      <Panel>
        <PanelHeader
          icon={TrendingUp}
          title="Revenue Snapshot"
          subtitle="Current audit period"
          tone="indigo"
          actions={
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-white">{money(revenue, cur)}</span>
              <Link
                href="/night-audit/reports"
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10.5px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                Full report
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          }
        />

        <div className="p-4">
          {/* Donut + legend */}
          {donutData.length > 0 ? (
            <div className="flex items-center gap-4 mb-4">
              <div className="relative shrink-0">
                <PieChart width={100} height={100}>
                  <Pie
                    data={donutData}
                    cx={46}
                    cy={46}
                    innerRadius={30}
                    outerRadius={46}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={donutData[i].color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTip />} />
                </PieChart>
                {/* Center value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono text-[10px] font-bold text-white leading-none">{money(totalDonutValue, cur, true)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {donutData.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                    <span className="truncate text-[10.5px] text-slate-400">{d.name}</span>
                    <span className="ml-auto pl-1 font-mono text-[10.5px] font-semibold tabular-nums" style={{ color: d.color }}>
                      {d.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 text-[12px] text-slate-500 mb-4">
              Revenue data pending
            </div>
          )}

          {/* Key metrics grid: 2×2 */}
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Room Revenue" value={money(curRevenue.roomRevenue, cur, true)} sub={money(curRevenue.roomRevenue, cur)} icon={BedDouble} color={TONE_HEX.indigo} />
            <MetricTile label="F&B / POS" value={money(curRevenue.fnbRevenue, cur, true)} sub="Food & beverage" icon={Banknote} color={TONE_HEX.amber} />
            <MetricTile label="ADR" value={money(adr, cur, true)} sub={`${occupied} occ rooms`} trend={trendDelta(adr, prevAdr)} icon={TrendingUp} color={TONE_HEX.violet} />
            <MetricTile label="RevPAR" value={money(revpar, cur, true)} sub={`${totalRooms} total rms`} trend={trendDelta(revpar, prevRevpar)} icon={BedDouble} color={TONE_HEX.sky} />
          </div>
        </div>
      </Panel>

      {/* Additional KPI strip: 2×3 for secondary metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricTile label="Payments" value={money(payments, cur, true)} sub="Captured today" icon={CreditCard} color={TONE_HEX.indigo} />
        <MetricTile label="Taxes" value={money(snap?.taxes ?? (last?.financialSnapshot ? Number(last.financialSnapshot.taxes) : 0), cur, true)} sub="Posted taxes" icon={Percent} color="#64748b" />
        <MetricTile label="Refunds" value={money(snap?.refunds ?? 0, cur, true)} sub="Posted refunds" icon={ArrowDownRight} color={TONE_HEX.rose} />
        <MetricTile label="Discounts" value={money(snap?.discounts ?? 0, cur, true)} sub="Applied" icon={Tag} color={TONE_HEX.amber} />
        {eventRevenue > 0 && (
          <MetricTile label="Event / Banquet" value={money(eventRevenue, cur, true)} sub="Revenue dept" icon={CalendarDays} color={TONE_HEX.violet} />
        )}
        <MetricTile label="Prior Audit" value={money(prevRevenue, cur, true)} sub="Day before last" icon={CalendarDays} color="#64748b" />
      </div>
    </div>
  );
}

import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  TrendingUp, Banknote, Users, ArrowUpRight, ArrowDownRight,
  Minus, BedDouble, CalendarDays, CreditCard, Tag, Percent
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie
} from 'recharts';

const currency = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

const currencyCompact = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en', { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }).format(value);

const DEPARTMENT_COLORS = ['#6366f1', '#f59e0b', '#fb923c', '#38bdf8', '#ec4899', '#14b8a6', '#2dd4bf', '#10b981', '#a78bfa', '#f43f5e'];
const departmentKey = (name: string) => `department_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

function revenueBreakdown(audit: any) {
  const fallback = audit?.financialSnapshot || {};
  const rows = audit?.closePackage?.controlSummary?.departmentReconciliation;
  if (!Array.isArray(rows)) {
    const values = {
      roomRevenue: Number(fallback.roomRevenue || 0),
      fnbRevenue: Number(fallback.fnbRevenue || 0),
      otherRevenue: Number(fallback.otherRevenue || 0),
    };
    return {
      ...values,
      eventFoodRevenue: 0,
      poolRevenue: 0,
      eventHallRevenue: 0,
      eventEquipmentRevenue: 0,
      spaRevenue: 0,
      laundryRevenue: 0,
      transportRevenue: 0,
      telephoneRevenue: 0,
      internetRevenue: 0,
      minibarRevenue: 0,
      cityLedgerRevenue: 0,
      manualRevenue: 0,
      serviceChargeRevenue: 0,
      departments: [
        { name: 'Rooms', value: values.roomRevenue, key: departmentKey('Rooms'), color: DEPARTMENT_COLORS[0] },
        { name: 'F&B / POS', value: values.fnbRevenue, key: departmentKey('F&B / POS'), color: DEPARTMENT_COLORS[1] },
        { name: 'Other', value: values.otherRevenue, key: departmentKey('Other'), color: DEPARTMENT_COLORS[7] },
      ].filter((department) => department.value > 0),
    };
  }
  const valueFor = (department: string) => Number(rows.find((row: any) => row.department === department)?.source || 0);
  const departments = rows
    .filter((row: any) => row.department !== 'Taxes' && Number(row.source || 0) > 0)
    .map((row: any, index: number) => ({
      name: String(row.department),
      value: Number(row.source || 0),
      key: departmentKey(String(row.department)),
      color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
    }));
  return {
    roomRevenue: valueFor('Rooms'),
    fnbRevenue: valueFor('F&B/POS'),
    eventFoodRevenue: valueFor('Event Food'),
    poolRevenue: valueFor('Recreation/Pool'),
    eventHallRevenue: valueFor('Event Hall'),
    eventEquipmentRevenue: valueFor('Event Equipment'),
    otherRevenue: valueFor('Other'),
    serviceChargeRevenue: valueFor('Service Charge'),
    spaRevenue: 0,
    laundryRevenue: 0,
    transportRevenue: 0,
    telephoneRevenue: 0,
    internetRevenue: 0,
    minibarRevenue: 0,
    cityLedgerRevenue: 0,
    manualRevenue: 0,
    departments,
  };
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  icon: React.ElementType;
  tone?: 'default' | 'rose' | 'emerald' | 'amber' | 'indigo' | 'violet' | 'sky';
}

const TONE_MAP = {
  default: { icon: 'border-slate-600/40 bg-slate-600/15 text-slate-300', glow: 'rgba(100,116,139,0.15)' },
  rose: { icon: 'border-rose-400/30 bg-rose-400/[0.12] text-rose-400', glow: 'rgba(244,63,94,0.15)' },
  emerald: { icon: 'border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-400', glow: 'rgba(16,185,129,0.15)' },
  amber: { icon: 'border-amber-400/30 bg-amber-400/[0.12] text-amber-400', glow: 'rgba(245,158,11,0.15)' },
  indigo: { icon: 'border-indigo-400/30 bg-indigo-400/[0.12] text-indigo-400', glow: 'rgba(99,102,241,0.15)' },
  violet: { icon: 'border-violet-400/30 bg-violet-400/[0.12] text-violet-400', glow: 'rgba(139,92,246,0.15)' },
  sky: { icon: 'border-sky-400/30 bg-sky-400/[0.12] text-sky-400', glow: 'rgba(14,165,233,0.15)' },
};

function MetricCard({ label, value, subtext, trend, icon: Icon, tone = 'default' }: MetricCardProps) {
  const tc = TONE_MAP[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] border border-white/[0.06] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.1]"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Hover glow */}
      <div
        className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: tc.glow }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-white">{value}</h3>
          {subtext && <p className="mt-0.5 text-[11px] text-slate-500">{subtext}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tc.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
          {trend > 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-emerald-300">
                <ArrowUpRight className="h-3 w-3" />{trend.toFixed(1)}%
              </span>
              <span className="text-slate-600">vs prior</span>
            </>
          ) : trend < 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-400/25 bg-rose-400/[0.08] px-2 py-0.5 text-rose-300">
                <ArrowDownRight className="h-3 w-3" />{Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-slate-600">vs prior</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-600/30 bg-slate-600/[0.08] px-2 py-0.5 text-slate-400">
                <Minus className="h-3 w-3" />0.0%
              </span>
              <span className="text-slate-600">no change</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const DarkTooltip = ({ active, payload, label, baseCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-2xl border border-white/[0.1] p-4 shadow-2xl" style={{ background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(16px)' }}>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, i: number) => (
            entry.value > 0 && (
              <div key={i} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-medium text-slate-300">{entry.name}</span>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums text-white">{currency(entry.value, baseCurrency)}</span>
              </div>
            )
          ))}
          <div className="mt-2 flex items-center justify-between gap-6 border-t border-white/[0.08] pt-2">
            <span className="text-xs font-semibold text-slate-300">Total</span>
            <span className="font-mono text-xs font-bold tabular-nums text-amber-300">
              {currency(payload.reduce((s: number, e: any) => s + e.value, 0), baseCurrency)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/[0.1] px-3 py-2 shadow-xl" style={{ background: 'rgba(10,14,26,0.97)' }}>
        <p className="text-xs font-bold text-white">{payload[0].name}</p>
        <p className="text-[10px] text-slate-400">{payload[0].payload.pct?.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

export function MetricCards({ data }: { data: NightAuditData }) {
  const baseCurrency = data.property.baseCurrency;
  const currentSnapshot = data.financialSnapshot || data.currentAudit?.financialSnapshot;
  const trendData = data.analytics.trend || [];
  const lastAudit = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previousAudit = trendData.length > 1 ? trendData[trendData.length - 2] : null;

  const revenue = lastAudit ? Number(lastAudit.totalRevenue) : (data.analytics.revenue || 0);
  const adr = lastAudit ? Number(lastAudit.adr) : 0;
  const revpar = lastAudit ? Number(lastAudit.revpar) : 0;
  const totalRooms = data.analytics.rooms?.total || 0;
  const occupied = lastAudit
    ? Math.round((Number(lastAudit.occupancy) / 100) * totalRooms)
    : (data.analytics.rooms?.occupied || 0);
  const payments = data.analytics.payments || 0;
  const inHouseGuests = data.analytics.inHouseGuests || 0;
  const openSessions = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0);

  let revTrend: number | undefined;
  let adrTrend: number | undefined;
  let revparTrend: number | undefined;

  if (lastAudit && previousAudit) {
    const pRev = Number(previousAudit.totalRevenue) || 0;
    const pAdr = Number(previousAudit.adr) || 0;
    const pRevpar = Number(previousAudit.revpar) || 0;
    if (pRev > 0) revTrend = ((revenue - pRev) / pRev) * 100;
    if (pAdr > 0) adrTrend = ((adr - pAdr) / pAdr) * 100;
    if (pRevpar > 0) revparTrend = ((revpar - pRevpar) / pRevpar) * 100;
  }

  const previousAuditRevenue = previousAudit ? Number(previousAudit.totalRevenue) : 0;

  const chartData = trendData.map((t) => {
    let dateStr = 'N/A';
    try {
      const d = new Date(t.businessDate);
      if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { /* ignore */ }
    const breakdown = revenueBreakdown(t);
    return {
      date: dateStr,
      ...breakdown,
      ...Object.fromEntries(breakdown.departments.map((department) => [department.key, department.value])),
    };
  });

  const currentRevenue = revenueBreakdown({
    financialSnapshot: currentSnapshot || lastAudit?.financialSnapshot,
    closePackage: data.currentAudit?.closePackage || lastAudit?.closePackage,
  });

  const departmentSeries = Array.from(new Map(
    [...chartData.flatMap((day: any) => day.departments || []), ...currentRevenue.departments]
      .map((department: any) => [department.key, department]),
  ).values());

  // Department donut data
  const donutData = currentRevenue.departments.map((department) => ({
    name: department.name,
    value: department.value,
    color: department.color,
  }));
  const totalForDonut = donutData.reduce((s, d) => s + d.value, 0);
  const donutDataWithPct = donutData.map((d) => ({ ...d, pct: totalForDonut > 0 ? (d.value / totalForDonut) * 100 : 0 }));

  return (
    <div className="space-y-5">
      {/* Revenue Hero + Chart + Donut */}
      <div
        className="rounded-[24px] border border-white/[0.06] p-6 sm:p-8"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Revenue figure */}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Gross Revenue — Last Audit</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {currency(revenue, baseCurrency)}
            </h2>
            {revTrend !== undefined && (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                {revTrend > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-emerald-300">
                      <ArrowUpRight className="h-4 w-4" />{revTrend.toFixed(1)}%
                    </span>
                    <span className="text-slate-500">vs prior audit</span>
                  </>
                ) : revTrend < 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/[0.08] px-3 py-1 text-rose-300">
                      <ArrowDownRight className="h-4 w-4" />{Math.abs(revTrend).toFixed(1)}%
                    </span>
                    <span className="text-slate-500">vs prior audit</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/30 bg-slate-600/[0.08] px-3 py-1 text-slate-400">
                    <Minus className="h-4 w-4" />No change
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Department donut */}
          {donutDataWithPct.length > 0 && (
            <div className="flex items-center gap-6 shrink-0">
              <div className="relative">
                <PieChart width={120} height={120}>
                  <Pie
                    data={donutDataWithPct}
                    cx={55}
                    cy={55}
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutDataWithPct.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Mix</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {donutDataWithPct.slice(0, 6).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-slate-400 leading-none">{d.name}</span>
                    <span className="ml-auto pl-3 font-mono text-[11px] font-bold tabular-nums text-slate-300">{d.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 7-day stacked bar chart */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={8} />
              <YAxis hide domain={[0, 'dataMax + (dataMax * 0.15)']} />
              <Tooltip content={<DarkTooltip baseCurrency={baseCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              {departmentSeries.map((series: any, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.name}
                  stackId="a"
                  fill={series.color}
                  radius={index === departmentSeries.length - 1 ? [4, 4, 0, 0] : index === 0 ? [0, 0, 4, 4] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Metric grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          label="Room Revenue"
          value={currencyCompact(currentRevenue.roomRevenue, baseCurrency)}
          subtext={currency(currentRevenue.roomRevenue, baseCurrency)}
          icon={BedDouble}
          tone="indigo"
        />
        <MetricCard
          label="F&B / POS"
          value={currencyCompact(currentRevenue.fnbRevenue, baseCurrency)}
          subtext="Food and beverage"
          icon={Banknote}
          tone="amber"
        />
        {currentRevenue.departments
          .filter((department) => department.name !== 'Rooms' && department.name !== 'F&B/POS' && department.name !== 'F&B / POS')
          .map((department) => (
            <MetricCard
              key={department.key}
              label={department.name}
              value={currencyCompact(department.value, baseCurrency)}
              subtext="Revenue department"
              icon={TrendingUp}
              tone="emerald"
            />
          ))}
        <MetricCard
          label="Taxes"
          value={currencyCompact(currentSnapshot?.taxes ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.taxes) : 0), baseCurrency)}
          subtext="Posted tax total"
          icon={Percent}
          tone="default"
        />
        <MetricCard
          label="Prior Audit"
          value={currencyCompact(previousAuditRevenue, baseCurrency)}
          subtext="Day before last"
          icon={CalendarDays}
          tone="default"
        />
        <MetricCard
          label="Payments"
          value={currencyCompact(payments, baseCurrency)}
          subtext="Captured today"
          icon={CreditCard}
          tone="indigo"
        />
        <MetricCard
          label="Refunds"
          value={currencyCompact(currentSnapshot?.refunds ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.refunds) : 0), baseCurrency)}
          subtext="Posted refunds"
          icon={ArrowDownRight}
          tone="rose"
        />
        <MetricCard
          label="Discounts"
          value={currencyCompact(currentSnapshot?.discounts ?? (lastAudit?.financialSnapshot ? Number(lastAudit.financialSnapshot.discounts) : 0), baseCurrency)}
          subtext="Applied discounts"
          icon={Tag}
          tone="amber"
        />
        <MetricCard
          label="ADR"
          value={currencyCompact(adr, baseCurrency)}
          subtext={`${occupied} occupied rooms`}
          trend={adrTrend}
          icon={TrendingUp}
          tone="violet"
        />
        <MetricCard
          label="RevPAR"
          value={currencyCompact(revpar, baseCurrency)}
          subtext={`${totalRooms} total rooms`}
          trend={revparTrend}
          icon={BedDouble}
          tone="sky"
        />
        <MetricCard
          label="In-house"
          value={inHouseGuests}
          subtext={`${openSessions} open sessions`}
          icon={Users}
          tone="indigo"
        />
      </div>
    </div>
  );
}

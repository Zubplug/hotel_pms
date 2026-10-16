import React, { useState } from 'react';
import {
  ResponsiveContainer, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Area, AreaChart
} from 'recharts';
import { TrendData } from '@/types/night-audit';
import { format } from 'date-fns';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const fmt = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en', { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }).format(value);

const fmtFull = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

const DarkTooltip = ({ active, payload, label, baseCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-2xl border border-white/[0.1] p-4 shadow-2xl"
        style={{ background: 'rgba(8,12,24,0.98)', backdropFilter: 'blur(20px)' }}
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color || entry.stroke }}
                />
                <span className="text-xs font-medium text-slate-300">{entry.name}</span>
              </div>
              <span className="font-mono text-xs font-bold tabular-nums text-white">
                {fmtFull(Number(entry.value), baseCurrency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

type Metric = 'all' | 'revenue' | 'adr' | 'revpar';

const METRIC_FILTERS: { key: Metric; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#f59e0b' },
  { key: 'revenue', label: 'Revenue', color: '#6366f1' },
  { key: 'adr', label: 'ADR', color: '#10b981' },
  { key: 'revpar', label: 'RevPAR', color: '#0ea5e9' },
];

export function RevenueTrendChart({
  trend,
  baseCurrency,
}: {
  trend: TrendData[] | undefined;
  baseCurrency: string;
}) {
  const [activeMetric, setActiveMetric] = useState<Metric>('all');

  if (!trend || trend.length === 0) {
    return (
      <div
        className="flex h-full flex-col rounded-[24px] border border-white/[0.06] p-6 sm:p-7"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">Seven-Day Performance</h3>
            <p className="text-[11px] text-slate-500">Revenue and performance trend</p>
          </div>
        </div>
        <div className="mt-4 flex flex-1 min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/[0.06]">
          <p className="text-sm text-slate-500">No historical data available yet</p>
        </div>
      </div>
    );
  }

  const data = trend.map((day) => ({
    ...day,
    formattedDate: format(new Date(day.businessDate), 'dd MMM'),
    revenue: Number(day.totalRevenue) || 0,
    adr: Number(day.adr) || 0,
    revpar: Number(day.revpar) || 0,
  }));

  // Calculate trend delta (last vs previous)
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const revDelta = prev && prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : null;

  const showRevenue = activeMetric === 'all' || activeMetric === 'revenue';
  const showAdr = activeMetric === 'all' || activeMetric === 'adr';
  const showRevpar = activeMetric === 'all' || activeMetric === 'revpar';

  return (
    <div
      className="flex h-full flex-col rounded-[24px] border border-white/[0.06] p-6 sm:p-7"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">Seven-Day Performance</h3>
            <p className="text-[11px] text-slate-500">
              Revenue, ADR &amp; RevPAR trend
              {revDelta !== null && (
                <span
                  className={`ml-2 inline-flex items-center gap-0.5 font-bold ${revDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {revDelta >= 0
                    ? <ArrowUpRight className="h-3 w-3" />
                    : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(revDelta).toFixed(1)}%
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
          {METRIC_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveMetric(f.key)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all duration-150"
              style={
                activeMetric === f.key
                  ? { background: `${f.color}20`, color: f.color, border: `1px solid ${f.color}40` }
                  : { color: '#64748b' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-6 min-h-[260px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="revGradTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="formattedDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(val: number) => {
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}m`;
                if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                return `${val}`;
              }}
              width={44}
            />
            <Tooltip
              content={<DarkTooltip baseCurrency={baseCurrency} />}
              cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }}
            />

            {showRevenue && (
              <Area
                type="monotone"
                dataKey="revenue"
                fill="url(#revGradTrend)"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                name="Revenue"
              />
            )}
            {showAdr && (
              <Line
                type="monotone"
                dataKey="adr"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                name="ADR"
                strokeDasharray={activeMetric === 'all' ? '5 3' : undefined}
              />
            )}
            {showRevpar && (
              <Line
                type="monotone"
                dataKey="revpar"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#0ea5e9', strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                name="RevPAR"
                strokeDasharray={activeMetric === 'all' ? '2 4' : undefined}
              />
            )}

            {activeMetric === 'all' && (
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '16px', color: '#94a3b8' }}
                iconType="plainline"
                iconSize={16}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer summary row */}
      {data.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-4">
          {[
            { label: 'Avg Revenue', value: fmt(data.reduce((s, d) => s + d.revenue, 0) / data.length, baseCurrency), color: '#6366f1' },
            { label: 'Avg ADR', value: fmt(data.reduce((s, d) => s + d.adr, 0) / data.length, baseCurrency), color: '#10b981' },
            { label: 'Avg RevPAR', value: fmt(data.reduce((s, d) => s + d.revpar, 0) / data.length, baseCurrency), color: '#0ea5e9' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{stat.label}</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

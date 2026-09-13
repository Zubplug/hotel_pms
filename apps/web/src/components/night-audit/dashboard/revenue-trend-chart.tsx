import React, { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart
} from 'recharts';
import { TrendData } from '@/types/night-audit';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

const currency = (value: number, code = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

const DarkTooltip = ({ active, payload, label, baseCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.95)' }}>
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                <span className="text-xs font-medium text-slate-300">{entry.name}</span>
              </div>
              <span className="text-xs font-bold text-white">{currency(Number(entry.value), baseCurrency)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

type Metric = 'all' | 'revenue' | 'adr' | 'revpar';

export function RevenueTrendChart({ trend, baseCurrency }: { trend: TrendData[] | undefined; baseCurrency: string }) {
  const [activeMetric, setActiveMetric] = useState<Metric>('all');

  const emptyState = (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-white">Seven-Day Performance</h3>
          <p className="text-[11px] text-slate-500">Revenue and performance trend</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10">
        <p className="text-sm text-slate-500">No historical data available</p>
      </div>
    </div>
  );

  if (!trend || trend.length === 0) return emptyState;

  const data = trend.map((day) => ({
    ...day,
    formattedDate: format(new Date(day.businessDate), 'dd MMM'),
    revenue: Number(day.totalRevenue) || 0,
    adr: Number(day.adr) || 0,
    revpar: Number(day.revpar) || 0,
  }));

  const showRevenue = activeMetric === 'all' || activeMetric === 'revenue';
  const showAdr = activeMetric === 'all' || activeMetric === 'adr';
  const showRevpar = activeMetric === 'all' || activeMetric === 'revpar';

  const filters: { key: Metric; label: string; active: string; inactive: string }[] = [
    { key: 'all', label: 'All', active: 'bg-white/15 text-white', inactive: 'text-slate-500 hover:text-slate-300' },
    { key: 'revenue', label: 'Revenue', active: 'bg-indigo-500/25 text-indigo-300 border border-indigo-400/30', inactive: 'text-slate-500 hover:text-slate-300' },
    { key: 'adr', label: 'ADR', active: 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30', inactive: 'text-slate-500 hover:text-slate-300' },
    { key: 'revpar', label: 'RevPAR', active: 'bg-sky-500/25 text-sky-300 border border-sky-400/30', inactive: 'text-slate-500 hover:text-slate-300' },
  ];

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">Seven-Day Performance</h3>
            <p className="text-[11px] text-slate-500">Revenue and performance trend</p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveMetric(f.key)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${activeMetric === f.key ? f.active : f.inactive}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-5 min-h-[250px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="formattedDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val: number) => {
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}m`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                return `${val}`;
              }}
            />
            <Tooltip
              content={<DarkTooltip baseCurrency={baseCurrency} />}
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
            />
            {showRevenue && (
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill="url(#revGrad)"
                stroke="#6366f1"
                strokeWidth={1.5}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
                name="Revenue"
              />
            )}
            {showAdr && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="adr"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#10b981' }}
                name="ADR"
              />
            )}
            {showRevpar && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revpar"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#0ea5e9' }}
                name="RevPAR"
              />
            )}
            {activeMetric === 'all' && (
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '14px', color: '#94a3b8' }}
                iconType="circle"
                iconSize={7}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

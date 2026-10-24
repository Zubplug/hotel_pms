'use client';
import React, { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { TrendData } from '@/types/night-audit';
import { format } from 'date-fns';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Panel, PanelHeader, Tabs, money, TONE_HEX } from './ui';

type Metric = 'all' | 'revenue' | 'adr' | 'revpar';
const FILTERS: { key: Metric; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: TONE_HEX.amber },
  { key: 'revenue', label: 'Revenue', color: TONE_HEX.indigo },
  { key: 'adr', label: 'ADR', color: TONE_HEX.emerald },
  { key: 'revpar', label: 'RevPAR', color: TONE_HEX.sky },
];

const ChartTooltip = ({ active, payload, label, cur }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#06090f]/98 px-3 py-2.5 shadow-2xl text-[11px]">
      <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      {payload.filter((e: any) => e.value > 0).map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color || e.stroke }} />
            {e.name}
          </span>
          <span className="font-mono font-bold tabular-nums text-white">{money(Number(e.value), cur)}</span>
        </div>
      ))}
    </div>
  );
};

export function RevenueTrendChart({ trend, baseCurrency }: { trend: TrendData[] | undefined; baseCurrency: string }) {
  const [metric, setMetric] = useState<Metric>('all');

  if (!trend || trend.length === 0) {
    return (
      <Panel>
        <PanelHeader icon={TrendingUp} title="7-Day Performance" subtitle="Revenue, ADR & RevPAR trend" tone="indigo" />
        <div className="flex flex-1 min-h-[200px] items-center justify-center p-6">
          <p className="text-[12px] text-slate-500">No historical data available yet</p>
        </div>
      </Panel>
    );
  }

  const data = trend.map((d) => ({
    date: format(new Date(d.businessDate), 'dd MMM'),
    revenue: Number(d.totalRevenue) || 0,
    adr: Number(d.adr) || 0,
    revpar: Number(d.revpar) || 0,
  }));

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const revDelta = prev && prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : null;

  const avgOf = (key: 'revenue' | 'adr' | 'revpar') =>
    data.reduce((s, d) => s + d[key], 0) / data.length;

  return (
    <Panel>
      <PanelHeader
        icon={TrendingUp}
        title="7-Day Performance"
        subtitle="Revenue, ADR & RevPAR trend"
        tone="indigo"
        actions={
          <>
            {revDelta !== null && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${revDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {revDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(revDelta).toFixed(1)}%
              </span>
            )}
            <Tabs<Metric>
              value={metric}
              onChange={setMetric}
              items={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
            />
          </>
        }
      />

      <div className="px-3 pt-4 pb-2" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TONE_HEX.indigo} stopOpacity={0.25} />
                <stop offset="100%" stopColor={TONE_HEX.indigo} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              width={40}
            />
            <Tooltip content={<ChartTooltip cur={baseCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />

            {(metric === 'all' || metric === 'revenue') && (
              <Area type="monotone" dataKey="revenue" fill="url(#revGrad)" stroke={TONE_HEX.indigo} strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: TONE_HEX.indigo, strokeWidth: 2, stroke: '#fff' }} name="Revenue" />
            )}
            {(metric === 'all' || metric === 'adr') && (
              <Line type="monotone" dataKey="adr" stroke={TONE_HEX.emerald} strokeWidth={1.5}
                dot={{ r: 2.5, fill: TONE_HEX.emerald, strokeWidth: 0 }} name="ADR"
                strokeDasharray={metric === 'all' ? '5 3' : undefined} />
            )}
            {(metric === 'all' || metric === 'revpar') && (
              <Line type="monotone" dataKey="revpar" stroke={TONE_HEX.sky} strokeWidth={1.5}
                dot={{ r: 2.5, fill: TONE_HEX.sky, strokeWidth: 0 }} name="RevPAR"
                strokeDasharray={metric === 'all' ? '2 4' : undefined} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary footer */}
      <div className="grid grid-cols-3 gap-px border-t border-white/[0.05] bg-white/[0.025]">
        {[
          { label: 'Avg Revenue', value: money(avgOf('revenue'), baseCurrency, true), color: TONE_HEX.indigo },
          { label: 'Avg ADR', value: money(avgOf('adr'), baseCurrency, true), color: TONE_HEX.emerald },
          { label: 'Avg RevPAR', value: money(avgOf('revpar'), baseCurrency, true), color: TONE_HEX.sky },
        ].map((s) => (
          <div key={s.label} className="bg-[#0b111e] px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{s.label}</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

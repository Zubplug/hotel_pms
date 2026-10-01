'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MonthlyPoint = { label: string; organizations: number; properties: number };
type StatusPoint = { status: string; count: number };

const tooltipStyle = {
  background: '#101b2f',
  border: '1px solid rgba(148, 163, 184, .2)',
  borderRadius: 12,
  color: '#e2e8f0',
};

export function HQPortfolioCharts({
  monthly,
  subscriptions,
  connections,
}: {
  monthly: MonthlyPoint[];
  subscriptions: StatusPoint[];
  connections: StatusPoint[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl shadow-slate-950/10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Portfolio growth</p>
            <p className="mt-1 text-xs text-slate-400">New organisations and properties · last 6 months</p>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">Live data</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="orgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,.11)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(129,140,248,.35)' }} />
              <Area type="monotone" dataKey="organizations" name="Organisations" stroke="#a5b4fc" strokeWidth={2.5} fill="url(#orgFill)" />
              <Area type="monotone" dataKey="properties" name="Properties" stroke="#34d399" strokeWidth={2} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl shadow-slate-950/10">
        <div className="mb-5">
          <p className="text-sm font-semibold text-white">Subscription mix</p>
          <p className="mt-1 text-xs text-slate-400">Current billing state across the portfolio</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subscriptions} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.11)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis dataKey="status" type="category" width={78} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="count" name="Subscriptions" fill="#818cf8" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl shadow-slate-950/10 xl:col-span-2">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Distribution health</p>
            <p className="mt-1 text-xs text-slate-400">OTA/channel connections by current status</p>
          </div>
          <a href="/hq/activity" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">View audit trail →</a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {connections.map((item) => (
            <div key={item.status} className="rounded-xl border border-white/8 bg-white/[.035] p-4">
              <p className="text-xs uppercase tracking-[.14em] text-slate-500">{item.status}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{item.count}</p>
            </div>
          ))}
          {connections.length === 0 && <p className="text-sm text-slate-400">No channel connections have been configured.</p>}
        </div>
      </section>
    </div>
  );
}

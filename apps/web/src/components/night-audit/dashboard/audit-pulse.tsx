import React from 'react';
import { Activity, AlertTriangle, BedDouble, CheckCircle2, ShieldCheck, Zap, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

/* ── Radial ring gauge ─────────────────────────────────────────────────────── */
function RingGauge({
  value,
  max = 100,
  size = 96,
  strokeWidth = 9,
  color,
  trackColor = 'rgba(255,255,255,0.05)',
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  label: string;
  sublabel?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  const dash = circumference * pct;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
            transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[1.4rem] font-bold leading-none tracking-tight text-white">{label}</span>
        {sublabel && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ── Mini sparkline (SVG path) ─────────────────────────────────────────────── */
function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return null;
  const w = 80;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h * 0.85 - h * 0.07;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={w} cy={parseFloat(pts[pts.length - 1].split(',')[1])} r="2.5" fill={color} />
    </svg>
  );
}

export function AuditPulse({ data }: { data: NightAuditData }) {
  const blockers = data.summary.blockers || 0;
  const warnings = data.summary.warnings || 0;
  const totalOpen = blockers + warnings;
  const rooms = data.analytics.rooms;
  const occupancy = rooms?.total ? Math.round((rooms.occupied / rooms.total) * 100) : 0;
  const activityCount = data.activityFeed?.length || 0;

  const controls = [
    { label: 'System', value: (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0), color: '#8b5cf6' },
    { label: 'Financial', value: (data.financial.highBalances?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0), color: '#f59e0b' },
    { label: 'Cash', value: (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0), color: '#f43f5e' },
    { label: 'Operations', value: (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((r) => r.issue).length || 0), color: '#0ea5e9' },
  ];
  const maxVal = Math.max(...controls.map((c) => c.value), 1);

  // Revenue sparkline from trend data
  const trendData = data.analytics.trend || [];
  const revenueSparkline = trendData.map((t) => Number(t.totalRevenue) || 0).slice(-7);
  const lastRevenue = revenueSparkline[revenueSparkline.length - 1] || 0;
  const prevRevenue = revenueSparkline[revenueSparkline.length - 2] || 0;
  const revDelta = prevRevenue > 0 ? ((lastRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const baseCurrency = data.property.baseCurrency;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: baseCurrency, notation: 'compact', maximumFractionDigits: 1 }).format(n);

  const isHealthy = totalOpen === 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

      {/* ── Tile 1: Operational Health Ring ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-white/[0.07] p-5 transition-all duration-200 hover:border-white/[0.12]"
        style={{
          background: 'linear-gradient(145deg, #0c1220 0%, #12103a 100%)',
          boxShadow: isHealthy ? '0 0 0 1px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-indigo-600/20 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300/60">Operational Health</p>
            <span className="mt-1 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              LIVE
            </span>
          </div>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-400"
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
        </div>

        <div className="relative mt-4 flex items-center gap-5">
          <RingGauge
            value={isHealthy ? 100 : Math.max(5, 100 - (totalOpen * 8))}
            max={100}
            size={88}
            strokeWidth={8}
            color={isHealthy ? '#10b981' : blockers > 0 ? '#f43f5e' : '#f59e0b'}
            label={isHealthy ? '✓' : String(totalOpen)}
            sublabel={isHealthy ? 'Healthy' : 'open'}
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-300">Blockers</span>
              <span className="font-mono text-[13px] font-bold tabular-nums text-rose-300">{blockers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-300">Warnings</span>
              <span className="font-mono text-[13px] font-bold tabular-nums text-amber-300">{warnings}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.05] pt-2">
              <span className="text-[11px] font-medium text-slate-500">Events</span>
              <span className="font-mono text-[11px] tabular-nums text-slate-400">{activityCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tile 2: Control Distribution ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-white/[0.06] p-5 backdrop-blur-md transition-all duration-200 hover:border-white/[0.1]"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold text-white">Control Distribution</p>
          </div>
          <span className="text-[10px] font-medium text-slate-500">{activityCount} events</span>
        </div>

        <div className="mt-5 space-y-3">
          {controls.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="w-[68px] text-xs font-medium text-slate-400">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(c.value ? 6 : 2, (c.value / maxVal) * 100)}%`,
                    background: c.color,
                    boxShadow: c.value > 0 ? `0 0 6px ${c.color}60` : 'none',
                  }}
                />
              </div>
              <span
                className="flex h-5 min-w-[22px] items-center justify-center rounded-md px-1.5 text-[10px] font-bold"
                style={{
                  background: `${c.color}20`,
                  color: c.color,
                  border: `1px solid ${c.color}30`,
                }}
              >
                {c.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-1.5 border-t border-white/[0.05] pt-3">
          {isHealthy ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All controls clear
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">{totalOpen} item{totalOpen !== 1 ? 's' : ''} need attention</span>
          )}
        </div>
      </div>

      {/* ── Tile 3: Demand Signal (Occupancy Ring) ────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-white/[0.06] p-5 backdrop-blur-md transition-all duration-200 hover:border-white/[0.1]"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-400/10 text-indigo-400">
            <BedDouble className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm font-semibold text-white">Demand Signal</p>
        </div>

        <div className="mt-5 flex flex-col items-center gap-4">
          <RingGauge
            value={occupancy}
            max={100}
            size={100}
            strokeWidth={9}
            color={occupancy >= 80 ? '#10b981' : occupancy >= 60 ? '#6366f1' : '#f59e0b'}
            label={`${occupancy}%`}
            sublabel="OCC"
          />

          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Occupied</span>
              <span className="font-mono font-bold tabular-nums text-white">{rooms?.occupied || 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Available</span>
              <span className="font-mono font-bold tabular-nums text-slate-300">{rooms?.total || 0}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Vacant</span>
              <span className="font-mono font-bold tabular-nums text-amber-300">{(rooms?.total || 0) - (rooms?.occupied || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tile 4: Revenue Snapshot ───────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-white/[0.06] p-5 backdrop-blur-md transition-all duration-200 hover:border-white/[0.1]"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold text-white">Revenue Snapshot</p>
          </div>
          {revDelta !== 0 && (
            <span
              className={`flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                revDelta > 0
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
              }`}
            >
              {revDelta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(revDelta).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Last Audit Revenue</p>
          <p className="mt-1 text-[1.6rem] font-bold tracking-tight text-white">
            {formatCurrency(lastRevenue)}
          </p>
          {prevRevenue > 0 && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Prior: {formatCurrency(prevRevenue)}
            </p>
          )}
        </div>

        {revenueSparkline.length > 2 && (
          <div className="mt-4">
            <div className="flex items-end justify-between mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">7-day trend</span>
            </div>
            <div className="overflow-hidden">
              <Sparkline
                data={revenueSparkline}
                color={revDelta >= 0 ? '#10b981' : '#f43f5e'}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.05] pt-3">
          <Zap className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[10px] text-slate-500">vs prior audit day</span>
        </div>
      </div>
    </div>
  );
}

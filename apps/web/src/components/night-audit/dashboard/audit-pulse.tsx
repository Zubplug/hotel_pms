import React from 'react';
import { Activity, AlertTriangle, BedDouble, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

export function AuditPulse({ data }: { data: NightAuditData }) {
  const blockers = data.summary.blockers || 0;
  const warnings = data.summary.warnings || 0;
  const totalOpen = blockers + warnings;
  const rooms = data.analytics.rooms;
  const occupancy = rooms?.total ? Math.round((rooms.occupied / rooms.total) * 100) : 0;
  const activityCount = data.activityFeed?.length || 0;

  const controls = [
    { label: 'System', value: (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0), color: '#8b5cf6', bg: 'bg-violet-500/20 text-violet-300' },
    { label: 'Financial', value: (data.financial.highBalances?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0), color: '#f59e0b', bg: 'bg-amber-500/20 text-amber-300' },
    { label: 'Cash', value: (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0), color: '#f43f5e', bg: 'bg-rose-500/20 text-rose-300' },
    { label: 'Operations', value: (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((r) => r.issue).length || 0), color: '#0ea5e9', bg: 'bg-sky-500/20 text-sky-300' },
  ];
  const maxVal = Math.max(...controls.map((c) => c.value), 1);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Open */}
      <div className="relative col-span-full overflow-hidden rounded-[24px] border border-white/[0.07] lg:col-span-1"
        style={{ background: 'linear-gradient(135deg, #0c1220 0%, #12103a 100%)' }}>
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-indigo-600/25 blur-2xl" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300/70">Operational Pulse</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">LIVE</span>
          </div>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-tight text-white">{totalOpen}</span>
            <span className="mb-1.5 text-xs leading-relaxed text-slate-400">open items<br />across all controls</span>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {blockers} blockers
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <Activity className="h-3.5 w-3.5" />
              {warnings} review
            </span>
          </div>
        </div>
      </div>

      {/* Control distribution */}
      <div className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-5 backdrop-blur-md sm:p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-white">Control Distribution</p>
          </div>
          <span className="text-[11px] font-medium text-slate-500">{activityCount} events today</span>
        </div>
        <div className="mt-5 space-y-3.5">
          {controls.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="w-[72px] text-xs font-medium text-slate-400">{c.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(c.value ? 8 : 2, (c.value / maxVal) * 100)}%`, background: c.color }}
                />
              </div>
              <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold ${c.bg}`}>
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Demand signal */}
      <div className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-5 backdrop-blur-md sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-400">
            <BedDouble className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-white">Demand Signal</p>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold tracking-tight text-white">{occupancy}%</span>
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {rooms?.occupied || 0}/{rooms?.total || 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">current occupancy</p>
        </div>

        {/* Occupancy ring */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${occupancy}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Use alongside ADR and RevPAR to assess revenue pressure before close.
          </p>
        </div>
      </div>
    </div>
  );
}

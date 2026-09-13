import React from 'react';
import {
  AlertTriangle, BookOpenCheck, CheckCircle2, CircleDollarSign,
  FileWarning, LockKeyhole, Zap, TrendingUp
} from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

const statusMeta: Record<string, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky' }> = {
  READY: { label: 'Ready to start', tone: 'indigo' },
  BLOCKED: { label: 'Blocked', tone: 'rose' },
  CANNOT_CLOSE: { label: 'Cannot close', tone: 'rose' },
  HAS_VARIANCE: { label: 'Has variance', tone: 'amber' },
  HAS_UNRESOLVED_EXCEPTIONS: { label: 'Unresolved exceptions', tone: 'amber' },
  IN_PROGRESS: { label: 'In progress', tone: 'sky' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  COMPLETED_WITH_EXCEPTIONS: { label: 'Completed w/ exceptions', tone: 'amber' },
  FAILED: { label: 'Failed', tone: 'rose' },
};

const toneClasses = {
  emerald: {
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    tile: 'border-emerald-400/20 bg-emerald-400/[0.06]',
    value: 'text-emerald-300',
    icon: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20',
    bar: 'bg-emerald-400',
    alert: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300',
  },
  amber: {
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    tile: 'border-amber-400/20 bg-amber-400/[0.06]',
    value: 'text-amber-300',
    icon: 'bg-amber-400/15 text-amber-400 border-amber-400/20',
    bar: 'bg-amber-400',
    alert: 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
  },
  rose: {
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    tile: 'border-rose-400/20 bg-rose-400/[0.06]',
    value: 'text-rose-300',
    icon: 'bg-rose-400/15 text-rose-400 border-rose-400/20',
    bar: 'bg-rose-400',
    alert: 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300',
  },
  indigo: {
    badge: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
    tile: 'border-indigo-400/20 bg-indigo-400/[0.06]',
    value: 'text-indigo-300',
    icon: 'bg-indigo-400/15 text-indigo-400 border-indigo-400/20',
    bar: 'bg-indigo-400',
    alert: 'border-indigo-400/20 bg-indigo-400/[0.06] text-indigo-300',
  },
  sky: {
    badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    tile: 'border-sky-400/20 bg-sky-400/[0.06]',
    value: 'text-sky-300',
    icon: 'bg-sky-400/15 text-sky-400 border-sky-400/20',
    bar: 'bg-sky-400',
    alert: 'border-sky-400/20 bg-sky-400/[0.06] text-sky-300',
  },
};

export function CloseControl({ data }: { data: NightAuditData }) {
  const close = data.closeControl;
  const statusDef = statusMeta[close?.status || 'READY'] || statusMeta.READY;
  const tone = toneClasses[statusDef.tone];
  const journal = data.accounting?.journal;
  const insights = data.insights || [];

  const controlMetrics = [
    {
      icon: BookOpenCheck,
      label: 'GL Control',
      value: journal?.status || 'NOT RUN',
      detail: `${journal?.postedEntryCount || 0} posted entries`,
      tone: journal?.status === 'BALANCED' ? 'emerald' : 'amber',
    },
    {
      icon: FileWarning,
      label: 'Open Exceptions',
      value: String(data.accounting?.transactionExceptions || 0),
      detail: 'Payment exceptions',
      tone: data.accounting?.transactionExceptions ? 'rose' : 'emerald',
    },
    {
      icon: BookOpenCheck,
      label: 'Acctg Period',
      value: data.accounting?.period?.status || 'NOT SET',
      detail: data.accounting?.period?.name || 'No active period',
      tone: data.accounting?.period?.status === 'OPEN' ? 'emerald' : 'amber',
    },
    {
      icon: CircleDollarSign,
      label: 'Balance Proof',
      value: close?.hasOpeningClosingBalance ? 'Available' : 'Pending',
      detail: close?.hasOpeningClosingBalance ? 'Date-scoped ledger' : 'Enhancement required',
      tone: close?.hasOpeningClosingBalance ? 'emerald' : 'amber',
    },
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
      {/* Financial Close Control */}
      <div className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Financial Close Control</h3>
              <p className="text-sm text-slate-400">Controller view of the current business-date close</p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${tone.badge}`}>
            {statusDef.label}
          </span>
        </div>

        {/* Control metric tiles */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {controlMetrics.map((m) => {
            const tc = toneClasses[m.tone];
            const Icon = m.icon;
            return (
              <div key={m.label} className={`rounded-2xl border p-3.5 ${tc.tile}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{m.label}</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg border ${tc.icon}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className={`mt-3 text-xl font-bold tracking-tight ${tc.value}`}>{m.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{m.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Balance proof banner */}
        <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-xs ${close?.hasOpeningClosingBalance ? toneClasses.emerald.alert : toneClasses.amber.alert}`}>
          {close?.hasOpeningClosingBalance
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="leading-relaxed">
            {close?.hasOpeningClosingBalance
              ? 'Opening, activity, and closing balances agree for all available dated ledgers.'
              : 'Balance proof is incomplete or contains a variance. Unavailable ledgers remain explicitly identified in the close package.'}
          </p>
        </div>
      </div>

      {/* Smart Audit Signals */}
      <div className="rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/10 text-violet-400">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Smart Signals</h3>
            <p className="text-[11px] text-slate-400">Deterministic audit insights</p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {insights.length ? insights.map((insight) => (
            <div
              key={`${insight.title}-${insight.metric}`}
              className={`flex items-start gap-2.5 rounded-xl border-l-[3px] bg-white/[0.03] p-3 ${insight.severity === 'HIGH' ? 'border-rose-400' : 'border-amber-400'}`}
            >
              {insight.severity === 'HIGH'
                ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                : <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <div>
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{insight.detail}</p>
              </div>
            </div>
          )) : (
            <div className="flex items-center gap-3 rounded-xl border border-l-[3px] border-emerald-400/30 bg-emerald-400/[0.06] p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-sm font-medium text-emerald-300">No abnormal close signals detected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

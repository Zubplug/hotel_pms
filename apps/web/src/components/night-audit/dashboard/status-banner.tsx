import React from 'react';
import { format } from 'date-fns';
import { NightAuditData } from '@/types/night-audit';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock3, Loader2, MoonStar, Play, AlertTriangle, FileCheck2, Sparkles, RefreshCcw } from 'lucide-react';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onRefresh: () => void;
  onOpenWizard: () => void;
  refreshing: boolean;
}

export function StatusBanner({ data, isAuditInProgress, onRefresh, onOpenWizard, refreshing }: StatusBannerProps) {
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const isReady = data.summary.blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';

  let statusColor = 'bg-amber-500/15 text-amber-200 border-amber-400/30';
  let statusIcon = <Clock3 className="h-5 w-5" />;
  let statusText = 'Audit Pending';
  let statusDescription = 'Awaiting daily close';

  if (data.auditState === 'COMPLETED') {
    statusColor = 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
    statusIcon = <CheckCircle2 className="h-5 w-5" />;
    statusText = 'Audit Complete';
    statusDescription = 'Business day closed';
  } else if (isAuditInProgress) {
    statusColor = 'bg-sky-500/15 text-sky-200 border-sky-400/30';
    statusIcon = <Loader2 className="h-5 w-5 animate-spin" />;
    statusText = 'Audit In Progress';
    statusDescription = 'Processing charges...';
  } else if (data.auditState === 'OVERDUE') {
    statusColor = 'bg-rose-500/15 text-rose-200 border-rose-400/30';
    statusIcon = <AlertTriangle className="h-5 w-5" />;
    statusText = 'Audit Overdue';
    statusDescription = 'Please close immediately';
  } else if (isReady) {
    statusColor = 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30';
    statusIcon = <FileCheck2 className="h-5 w-5" />;
    statusText = 'Audit Ready';
    statusDescription = 'All clear to run';
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.42)] md:p-8">
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.28),transparent_38%)]" />

      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
              <MoonStar className="h-3.5 w-3.5" />
              Night Audit Workspace
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {format(businessDate, 'EEEE, dd MMMM yyyy')}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {data.property.name || 'Property'} • {data.auditState === 'OVERDUE' ? 'Attention required' : 'Operations online'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className={`flex items-center gap-3 rounded-2xl border bg-slate-950/20 px-4 py-3 backdrop-blur-sm ${statusColor}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">{statusIcon}</div>
              <div>
                <p className="text-sm font-semibold text-white">{statusText}</p>
                <p className="text-[11px] text-slate-300">{statusDescription}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="lg"
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 font-semibold text-white hover:bg-white/10"
                onClick={onRefresh}
                disabled={refreshing}
              >
                <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                size="lg"
                className="flex items-center justify-center rounded-xl bg-indigo-500 px-5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
                onClick={onOpenWizard}
                disabled={isAuditInProgress || refreshing}
              >
                <Play className="mr-2 h-4 w-4 fill-current" />
                {isAuditInProgress ? 'Processing...' : data.auditState === 'COMPLETED' ? 'Review Audit' : isReady ? 'Run Audit' : 'Resolve Issues'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
              Reconciliations
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{data.summary.blockers}</div>
            <div className="text-xs text-slate-400">Open blockers</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              Warnings
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{data.summary.warnings}</div>
            <div className="text-xs text-slate-400">Needs review</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              <Clock3 className="h-3.5 w-3.5 text-amber-300" />
              Business date
            </div>
            <div className="mt-3 text-xl font-semibold text-white">{format(businessDate, 'dd MMM')}</div>
            <div className="text-xs text-slate-400">Daily cycle</div>
          </div>
        </div>
      </div>
    </div>
  );
}


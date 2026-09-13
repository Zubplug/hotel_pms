'use client';
import React from 'react';
import { format } from 'date-fns';
import { NightAuditData } from '@/types/night-audit';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Clock3, Loader2, MoonStar, Play,
  AlertTriangle, FileCheck2, Sparkles, CalendarDays, Radio, ChevronRight
} from 'lucide-react';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onOpenWizard: () => void;
  refreshing: boolean;
  managerMode?: boolean;
}

export function StatusBanner({ data, isAuditInProgress, onOpenWizard, refreshing, managerMode = false }: StatusBannerProps) {
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const isReady = data.summary.blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';
  const auditRecord = data.activeAudit || data.currentAudit;
  const lastCompleted = data.lastCompletedAudit || (data.currentAudit?.status === 'COMPLETED' ? data.currentAudit : null);
  const owner = auditRecord?.runByStaff;
  const ownerName = owner
    ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
    : auditRecord?.runBy
      ? 'Assigned auditor'
      : 'Automated / unassigned';

  type StateConfig = {
    badge: string;
    dot: string;
    icon: React.ReactNode;
    text: string;
    sub: string;
    pulse: boolean;
  };

  let cfg: StateConfig = {
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400',
    icon: <Clock3 className="h-4 w-4" />,
    text: 'Audit Pending',
    sub: 'Awaiting daily close',
    pulse: false,
  };

  if (data.auditState === 'COMPLETED') {
    cfg = { badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200', dot: 'bg-emerald-400', icon: <CheckCircle2 className="h-4 w-4" />, text: 'Audit Complete', sub: 'Business day closed', pulse: false };
  } else if (isAuditInProgress) {
    cfg = { badge: 'border-sky-400/40 bg-sky-400/10 text-sky-200', dot: 'bg-sky-400', icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Audit In Progress', sub: 'Processing charges…', pulse: true };
  } else if (data.auditState === 'OVERDUE') {
    cfg = { badge: 'border-rose-400/40 bg-rose-400/10 text-rose-200', dot: 'bg-rose-400', icon: <AlertTriangle className="h-4 w-4" />, text: 'Audit Overdue', sub: 'Close immediately', pulse: true };
  } else if (isReady) {
    cfg = { badge: 'border-indigo-400/40 bg-indigo-400/10 text-indigo-200', dot: 'bg-indigo-400', icon: <FileCheck2 className="h-4 w-4" />, text: 'Audit Ready', sub: 'All clear to run', pulse: false };
  }

  const ctaLabel = isAuditInProgress ? 'Resume Audit' : data.auditState === 'COMPLETED' ? 'View Completed' : 'Begin Audit';

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/[0.07] shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
      style={{ background: 'linear-gradient(135deg, #0c1220 0%, #0f172a 40%, #13103a 100%)' }}>

      {/* Background decorative layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-violet-700/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-800/10 blur-3xl" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative z-10 p-7 md:p-10">
        {/* Top strip */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
              <MoonStar className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-300/80">Night Audit · Command Center</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">Live</span>
            <span className="mx-1.5 h-3 w-px bg-white/15" />
            <CalendarDays className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-300">
              {format(businessDate, 'dd MMM yyyy')}
            </span>
          </div>
        </div>

        {/* Main content row */}
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-[2.6rem] font-bold leading-[1.1] tracking-[-0.04em] text-white md:text-5xl">
              {format(businessDate, 'EEEE')}
              <span className="text-white/40">,&nbsp;</span>
              {format(businessDate, 'dd MMMM yyyy')}
            </h2>
            <p className="mt-3 text-base text-slate-400">
              {data.property.name || 'Property'}&nbsp;&middot;&nbsp;
              {data.auditState === 'OVERDUE' ? 'Immediate attention required' : 'Operations online and tracking'}
            </p>

            {/* Meta row */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Auditor</span>
                <span className="font-medium text-white">{ownerName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Started</span>
                <span className="font-medium text-white">
                  {auditRecord?.startedAt ? format(new Date(auditRecord.startedAt), 'dd MMM, HH:mm') : 'Not started'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Last Closed</span>
                <span className="font-medium text-white">
                  {lastCompleted?.completedAt ? format(new Date(lastCompleted.completedAt), 'dd MMM, HH:mm') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Status + CTA */}
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center xl:flex-col xl:items-end">
            {/* Status chip */}
            <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 backdrop-blur-md ${cfg.badge}`}>
              <span className="relative flex h-2.5 w-2.5">
                {cfg.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
              </span>
              <span className="flex items-center gap-1.5">
                {cfg.icon}
                <span className="text-sm font-semibold text-white">{cfg.text}</span>
              </span>
              <span className="ml-1 text-[11px] opacity-70">{cfg.sub}</span>
            </div>

            {/* CTA Button */}
            {!managerMode && (
              <button
                onClick={onOpenWizard}
                disabled={isAuditInProgress || refreshing}
                className="group relative flex items-center gap-2.5 overflow-hidden rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_32px_rgba(99,102,241,0.35)] transition-all duration-200 hover:shadow-[0_0_48px_rgba(99,102,241,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
              >
                {/* Shine effect */}
                <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-[100%]" />
                <Play className="h-4 w-4 fill-current" />
                {ctaLabel}
                <ChevronRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom stats strip */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Blockers', value: data.summary.blockers, tone: data.summary.blockers > 0 ? 'text-rose-300' : 'text-emerald-300' },
            { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Warnings', value: data.summary.warnings, tone: data.summary.warnings > 0 ? 'text-amber-300' : 'text-emerald-300' },
            { icon: <CalendarDays className="h-3.5 w-3.5" />, label: 'Business Date', value: format(businessDate, 'dd MMM'), tone: 'text-indigo-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.06]">
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${s.tone}`}>
                {s.icon}
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">Daily cycle</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

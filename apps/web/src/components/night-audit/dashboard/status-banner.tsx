'use client';
import React from 'react';
import { format } from 'date-fns';
import { NightAuditData } from '@/types/night-audit';
import {
  CheckCircle2, Clock3, Loader2, MoonStar, Play,
  AlertTriangle, FileCheck2, Sparkles, CalendarDays, Radio, ChevronRight,
  ShieldCheck, FileText, Lock, BarChart2, Zap
} from 'lucide-react';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onOpenWizard: () => void;
  refreshing: boolean;
  managerMode?: boolean;
}

const AUDIT_STEPS = [
  { id: 1, label: 'Pre-check', short: 'Pre-check', icon: ShieldCheck },
  { id: 2, label: 'Post Charges', short: 'Charges', icon: Zap },
  { id: 3, label: 'Reconcile', short: 'Reconcile', icon: BarChart2 },
  { id: 4, label: 'Roll Date', short: 'Roll Date', icon: Lock },
  { id: 5, label: 'Reports', short: 'Reports', icon: FileText },
];

function getActiveStep(auditState: string, hasBlockers: boolean): number {
  if (auditState === 'COMPLETED') return 5;
  if (auditState === 'IN_PROGRESS' || auditState === 'POSTING') return 2;
  if (hasBlockers) return 1;
  if (auditState === 'OVERDUE') return 1;
  return 1; // PENDING / READY
}

function AuditStepper({ auditState, hasBlockers }: { auditState: string; hasBlockers: boolean }) {
  const activeStep = getActiveStep(auditState, hasBlockers);
  const isCompleted = auditState === 'COMPLETED';

  return (
    <div className="relative mt-8">
      {/* Connecting line */}
      <div className="absolute left-0 right-0 top-[18px] h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div
        className="absolute left-0 top-[18px] h-px transition-all duration-700 ease-out"
        style={{
          width: isCompleted ? '100%' : `${((activeStep - 1) / (AUDIT_STEPS.length - 1)) * 100}%`,
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
          boxShadow: '0 0 8px rgba(245,158,11,0.5)',
        }}
      />

      <div className="relative flex items-start justify-between">
        {AUDIT_STEPS.map((step) => {
          const done = isCompleted || step.id < activeStep;
          const active = !isCompleted && step.id === activeStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2" style={{ flex: 1 }}>
              <div
                className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500"
                style={{
                  borderColor: done ? '#d97706' : active ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                  background: done
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : active
                    ? 'rgba(245,158,11,0.15)'
                    : 'rgba(255,255,255,0.03)',
                  boxShadow: active ? '0 0 16px rgba(245,158,11,0.5)' : done ? '0 0 8px rgba(217,119,6,0.3)' : 'none',
                }}
              >
                {done && !active ? (
                  <CheckCircle2 className="h-4 w-4 text-amber-300" />
                ) : active && (auditState === 'IN_PROGRESS' || auditState === 'POSTING') ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                ) : (
                  <Icon className={`h-4 w-4 ${active ? 'text-amber-300' : 'text-slate-600'}`} />
                )}
              </div>
              <div className="text-center">
                <p className={`text-[10px] font-bold hidden sm:block ${done || active ? 'text-slate-300' : 'text-slate-600'}`}>
                  {step.label}
                </p>
                <p className={`text-[10px] font-bold sm:hidden ${done || active ? 'text-slate-300' : 'text-slate-600'}`}>
                  {step.short}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatusBanner({
  data,
  isAuditInProgress,
  onOpenWizard,
  refreshing,
  managerMode = false,
}: StatusBannerProps) {
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const isReady = data.summary.blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';
  const auditRecord = data.activeAudit || data.currentAudit;
  const lastCompleted = data.lastCompletedAudit || (data.currentAudit?.status === 'COMPLETED' ? data.currentAudit : null);
  const owner = auditRecord?.runByStaff;
  const ownerName = owner
    ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
    : auditRecord?.runBy
    ? 'Assigned auditor'
    : 'Auto / unassigned';

  type StateConfig = {
    badge: string;
    dot: string;
    icon: React.ReactNode;
    text: string;
    sub: string;
    pulse: boolean;
    glow: string;
  };

  let cfg: StateConfig = {
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400',
    icon: <Clock3 className="h-4 w-4" />,
    text: 'Audit Pending',
    sub: 'Awaiting daily close',
    pulse: false,
    glow: 'rgba(245,158,11,0.15)',
  };

  if (data.auditState === 'COMPLETED') {
    cfg = {
      badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
      dot: 'bg-emerald-400',
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: 'Audit Complete',
      sub: 'Business day closed',
      pulse: false,
      glow: 'rgba(16,185,129,0.12)',
    };
  } else if (isAuditInProgress) {
    cfg = {
      badge: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
      dot: 'bg-sky-400',
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: 'Audit In Progress',
      sub: 'Processing charges…',
      pulse: true,
      glow: 'rgba(56,189,248,0.12)',
    };
  } else if (data.auditState === 'OVERDUE') {
    cfg = {
      badge: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
      dot: 'bg-rose-400',
      icon: <AlertTriangle className="h-4 w-4" />,
      text: 'Audit Overdue',
      sub: 'Close immediately',
      pulse: true,
      glow: 'rgba(244,63,94,0.12)',
    };
  } else if (isReady) {
    cfg = {
      badge: 'border-indigo-400/40 bg-indigo-400/10 text-indigo-200',
      dot: 'bg-indigo-400',
      icon: <FileCheck2 className="h-4 w-4" />,
      text: 'Audit Ready',
      sub: 'All clear to run',
      pulse: false,
      glow: 'rgba(99,102,241,0.12)',
    };
  }

  const ctaLabel =
    isAuditInProgress ? 'Resume Audit' :
    data.auditState === 'COMPLETED' ? 'View Report' :
    data.auditState === 'OVERDUE' ? 'Run Audit Now' :
    'Begin Audit';

  const ctaVariant =
    data.auditState === 'OVERDUE' ? 'rose' :
    data.auditState === 'COMPLETED' ? 'emerald' :
    'amber';

  const ctaStyles: Record<string, React.CSSProperties> = {
    amber: {
      background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      boxShadow: '0 0 32px rgba(217,119,6,0.45), 0 4px 16px rgba(0,0,0,0.4)',
    },
    rose: {
      background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      boxShadow: '0 0 32px rgba(225,29,72,0.45), 0 4px 16px rgba(0,0,0,0.4)',
    },
    emerald: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      boxShadow: '0 0 32px rgba(5,150,105,0.35), 0 4px 16px rgba(0,0,0,0.4)',
    },
  };

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/[0.07]"
      style={{
        background: 'linear-gradient(145deg, #0a1020 0%, #0f172a 45%, #12103a 100%)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Background decorative layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Ambient glow based on state */}
        <div
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl transition-all duration-1000"
          style={{ background: cfg.glow }}
        />
        <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-indigo-700/8 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 h-96 w-96 rounded-full bg-violet-800/5 blur-3xl" />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Corner line accent */}
        <div
          className="absolute top-0 left-0 h-px w-1/3"
          style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.6), transparent)' }}
        />
        <div
          className="absolute top-0 left-0 w-px h-1/4"
          style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.6), transparent)' }}
        />
      </div>

      <div className="relative z-10 p-6 md:p-8 lg:p-10">
        {/* Top strip */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
              <MoonStar className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/70">
              Night Audit · Command Centre
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 backdrop-blur-md">
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">Server verified</span>
            <span className="mx-1.5 h-3 w-px bg-white/15" />
            <CalendarDays className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-300">
              {format(businessDate, 'dd MMM yyyy')}
            </span>
          </div>
        </div>

        {/* Main content row */}
        <div className="mt-6 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            {/* Date heading */}
            <h1 className="text-[2.4rem] font-bold leading-[1.05] tracking-[-0.04em] text-white md:text-5xl">
              <span
                className="block text-[13px] font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: 'rgba(245,158,11,0.7)' }}
              >
                {format(businessDate, 'EEEE')}
              </span>
              {format(businessDate, 'dd MMMM yyyy')}
            </h1>
            <p className="mt-3 text-base text-slate-400">
              {data.property.name || 'Property'}&nbsp;&middot;&nbsp;
              <span className={data.auditState === 'OVERDUE' ? 'text-rose-400' : 'text-slate-400'}>
                {data.auditState === 'OVERDUE'
                  ? 'Immediate attention required'
                  : data.auditState === 'COMPLETED'
                  ? 'Business date closed successfully'
                  : 'Operations online and tracking'}
              </span>
            </p>

            {/* Meta row */}
            <div className="mt-6 flex flex-wrap gap-5 text-xs text-slate-400">
              {[
                { label: 'Auditor', value: ownerName },
                {
                  label: 'Started',
                  value: auditRecord?.startedAt ? format(new Date(auditRecord.startedAt), 'dd MMM, HH:mm') : 'Not started',
                },
                {
                  label: 'Last Closed',
                  value: lastCompleted?.completedAt ? format(new Date(lastCompleted.completedAt), 'dd MMM, HH:mm') : '—',
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {item.label}
                  </span>
                  <span className="font-medium text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status + CTA */}
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center xl:flex-col xl:items-end">
            {/* Status chip */}
            <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 backdrop-blur-md ${cfg.badge}`}>
              <span className="relative flex h-2.5 w-2.5">
                {cfg.pulse && (
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
              </span>
              <span className="flex items-center gap-1.5">
                {cfg.icon}
                <span className="text-sm font-bold text-white">{cfg.text}</span>
              </span>
              <span className="ml-1 text-[11px] opacity-60">{cfg.sub}</span>
            </div>

            {/* CTA Button */}
            {!managerMode && (
              <button
                onClick={onOpenWizard}
                disabled={isAuditInProgress || refreshing}
                className="group relative flex items-center gap-2.5 overflow-hidden rounded-2xl px-7 py-4 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                style={ctaStyles[ctaVariant]}
              >
                {/* Shine sweep */}
                <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-600 group-hover:translate-x-[100%]" />
                <Play className="h-4 w-4 fill-current" />
                {ctaLabel}
                <ChevronRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* Audit Stepper */}
        <AuditStepper auditState={data.auditState} hasBlockers={data.summary.blockers > 0} />

        {/* Bottom KPI strip */}
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {[
            {
              icon: <Sparkles className="h-3.5 w-3.5" />,
              label: 'Blockers',
              value: data.summary.blockers,
              tone: data.summary.blockers > 0 ? 'rose' : 'emerald',
              sub: data.summary.blockers > 0 ? 'Must resolve' : 'All clear',
            },
            {
              icon: <AlertTriangle className="h-3.5 w-3.5" />,
              label: 'Warnings',
              value: data.summary.warnings,
              tone: data.summary.warnings > 0 ? 'amber' : 'emerald',
              sub: data.summary.warnings > 0 ? 'Review needed' : 'No warnings',
            },
            {
              icon: <CalendarDays className="h-3.5 w-3.5" />,
              label: 'Business Date',
              value: format(businessDate, 'dd MMM'),
              tone: 'indigo',
              sub: 'Active audit date',
            },
            {
              icon: <Radio className="h-3.5 w-3.5" />,
              label: 'Audit State',
              value: data.auditState.replaceAll('_', ' '),
              tone: data.auditState === 'COMPLETED' ? 'emerald' : data.auditState === 'OVERDUE' ? 'rose' : 'amber',
              sub: 'System verified',
            },
          ].map((s) => {
            const toneMap: Record<string, string> = {
              rose: 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300',
              amber: 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
              emerald: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300',
              indigo: 'border-indigo-400/20 bg-indigo-400/[0.06] text-indigo-300',
            };
            return (
              <div
                key={s.label}
                className={`rounded-2xl border px-4 py-3.5 transition-all duration-200 hover:brightness-110 ${toneMap[s.tone] || toneMap.amber}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                  {s.icon}
                  {s.label}
                </div>
                <div className="mt-2 text-xl font-bold tracking-tight text-white">{s.value}</div>
                <div className="mt-0.5 text-[11px] opacity-50">{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

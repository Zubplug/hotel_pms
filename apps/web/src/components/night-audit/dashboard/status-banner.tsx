'use client';
import React from 'react';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import { NightAuditData } from '@/types/night-audit';
import {
  CheckCircle2, Clock3, Loader2, MoonStar, Play, AlertTriangle, FileCheck2,
  CalendarDays, ChevronRight, ShieldCheck, FileText, Lock, BarChart2, Zap,
  UserRound, History, Timer, ShieldAlert,
} from 'lucide-react';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onOpenWizard: () => void;
  refreshing: boolean;
  managerMode?: boolean;
}

const AUDIT_STEPS = [
  { id: 1, label: 'Pre-check', icon: ShieldCheck },
  { id: 2, label: 'Post charges', icon: Zap },
  { id: 3, label: 'Reconcile', icon: BarChart2 },
  { id: 4, label: 'Roll date', icon: Lock },
  { id: 5, label: 'Reports', icon: FileText },
];

function getActiveStep(auditState: string): number {
  if (auditState === 'COMPLETED') return 5;
  if (auditState === 'IN_PROGRESS' || auditState === 'POSTING') return 2;
  return 1;
}

type Tone = 'amber' | 'emerald' | 'sky' | 'rose' | 'indigo';

const TONE: Record<Tone, { pill: string; dot: string; accent: string; btn: string }> = {
  amber:   { pill: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200',     dot: 'bg-amber-400',   accent: '#f59e0b', btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950' },
  emerald: { pill: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200', dot: 'bg-emerald-400', accent: '#10b981', btn: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' },
  sky:     { pill: 'border-sky-400/25 bg-sky-400/[0.08] text-sky-200',           dot: 'bg-sky-400',     accent: '#38bdf8', btn: 'bg-sky-500 hover:bg-sky-400 text-slate-950' },
  rose:    { pill: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200',        dot: 'bg-rose-400',    accent: '#f43f5e', btn: 'bg-rose-500 hover:bg-rose-400 text-white' },
  indigo:  { pill: 'border-indigo-400/25 bg-indigo-400/[0.08] text-indigo-200',  dot: 'bg-indigo-400',  accent: '#818cf8', btn: 'bg-indigo-500 hover:bg-indigo-400 text-white' },
};

function AuditStepper({ auditState, tone }: { auditState: string; tone: Tone }) {
  const activeStep = getActiveStep(auditState);
  const isCompleted = auditState === 'COMPLETED';
  const running = auditState === 'IN_PROGRESS' || auditState === 'POSTING';
  const accent = TONE[tone].accent;

  return (
    <ol className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Audit progress">
      {AUDIT_STEPS.map((step, i) => {
        const done = isCompleted || step.id < activeStep;
        const active = !isCompleted && step.id === activeStep;
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5">
            <div
              className={`flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                active ? 'bg-white/[0.06] text-white' : done ? 'text-slate-300' : 'text-slate-600'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: done ? accent : active ? `${accent}26` : 'rgba(255,255,255,0.05)',
                  boxShadow: active ? `0 0 0 1px ${accent}80` : undefined,
                }}
              >
                {done ? (
                  <CheckCircle2 className="h-3 w-3 text-slate-950" strokeWidth={3} />
                ) : active && running ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: accent }} />
                ) : (
                  <Icon className="h-2.5 w-2.5" style={{ color: active ? accent : undefined }} />
                )}
              </span>
              <span className="hidden truncate md:inline">{step.label}</span>
            </div>
            {i < AUDIT_STEPS.length - 1 && (
              <span
                className="h-px min-w-[8px] flex-1 rounded-full"
                style={{ background: done ? `${accent}99` : 'rgba(255,255,255,0.07)' }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Counter({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: 'rose' | 'amber' | 'emerald' }) {
  const color = { rose: 'text-rose-300', amber: 'text-amber-300', emerald: 'text-emerald-300' }[tone];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className={`font-mono text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <div className="leading-tight">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
        <p className="text-xs font-medium text-slate-200">{value}</p>
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
  const { data: session } = useSession();
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const isReady = data.summary.blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';
  const auditRecord = data.activeAudit || data.currentAudit;
  const lastCompleted = data.lastCompletedAudit || (data.currentAudit?.status === 'COMPLETED' ? data.currentAudit : null);
  const owner = auditRecord?.runByStaff;
  const currentUserName = session?.user?.name || session?.user?.email || '';
  const ownerName = owner
    ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
    : auditRecord?.runBy
      ? currentUserName || 'Assigned auditor'
      : auditRecord?.status === 'COMPLETED'
        ? 'System'
        : currentUserName || 'Current auditor';

  let tone: Tone = 'amber';
  let statusText = 'Pending';
  let statusSub = 'Awaiting daily close';
  let StatusIcon: React.ElementType = Clock3;
  let pulse = false;

  if (data.auditState === 'COMPLETED') {
    tone = 'emerald'; statusText = 'Closed'; statusSub = 'Business day closed'; StatusIcon = CheckCircle2;
  } else if (isAuditInProgress) {
    tone = 'sky'; statusText = 'In progress'; statusSub = 'Posting charges'; StatusIcon = Loader2; pulse = true;
  } else if (data.auditState === 'OVERDUE') {
    tone = 'rose'; statusText = 'Overdue'; statusSub = 'Close immediately'; StatusIcon = AlertTriangle; pulse = true;
  } else if (isReady) {
    tone = 'indigo'; statusText = 'Ready'; statusSub = 'All clear to run'; StatusIcon = FileCheck2;
  }

  const ctaLabel =
    isAuditInProgress ? 'Resume audit' :
    data.auditState === 'COMPLETED' ? 'View report' :
    data.auditState === 'OVERDUE' ? 'Run audit now' :
    'Begin audit';

  const t = TONE[tone];

  return (
    <section
      aria-labelledby="night-audit-heading"
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b111e]/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      {/* State accent line */}
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${t.accent}, ${t.accent}00 70%)` }} />

      {/* Tier 1 — identity, status, meta, action */}
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-indigo-200">
            <MoonStar className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 id="night-audit-heading" className="text-[17px] font-semibold tracking-tight text-white">
                Night Audit
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${t.pill}`}>
                <span className="relative flex h-1.5 w-1.5">
                  {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${t.dot}`} />}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
                </span>
                <StatusIcon className={`h-3 w-3 ${isAuditInProgress ? 'animate-spin' : ''}`} />
                {statusText}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              <CalendarDays className="h-3 w-3 text-slate-500" />
              <span className="font-medium text-slate-200">{format(businessDate, 'EEE, dd MMM yyyy')}</span>
              <span className="text-slate-600">·</span>
              <span className="truncate">{data.property.name || 'Property'}</span>
              <span className="text-slate-600">·</span>
              <span className={tone === 'rose' ? 'text-rose-300' : 'text-slate-500'}>{statusSub}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="hidden items-center gap-5 border-r border-white/[0.06] pr-6 xl:flex">
            <Meta icon={UserRound} label="Auditor" value={ownerName} />
            <Meta icon={Timer} label="Started" value={auditRecord?.startedAt ? format(new Date(auditRecord.startedAt), 'dd MMM, HH:mm') : 'Not started'} />
            <Meta icon={History} label="Last closed" value={lastCompleted?.completedAt ? format(new Date(lastCompleted.completedAt), 'dd MMM, HH:mm') : '—'} />
          </div>
          {!managerMode && (
            <button
              id="night-audit-primary-cta"
              onClick={onOpenWizard}
              disabled={isAuditInProgress || refreshing}
              className={`group inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50 ${t.btn}`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {ctaLabel}
              <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tier 2 — progress + readiness counters */}
      <div className="flex flex-col gap-3 border-t border-white/[0.05] bg-white/[0.015] px-5 py-2.5 md:flex-row md:items-center md:gap-6">
        <AuditStepper auditState={data.auditState} tone={tone} />
        <div className="flex shrink-0 items-center gap-2">
          <Counter icon={ShieldAlert} label="Blockers" value={data.summary.blockers} tone={data.summary.blockers > 0 ? 'rose' : 'emerald'} />
          <Counter icon={AlertTriangle} label="Warnings" value={data.summary.warnings} tone={data.summary.warnings > 0 ? 'amber' : 'emerald'} />
        </div>
      </div>
    </section>
  );
}

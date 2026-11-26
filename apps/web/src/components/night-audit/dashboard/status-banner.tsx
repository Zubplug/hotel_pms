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
import { PulsingBadge, GlowButton, TONE_HEX } from './ui';

interface StatusBannerProps {
  data: NightAuditData;
  isAuditInProgress: boolean;
  onOpenWizard: () => void;
  refreshing: boolean;
  managerMode?: boolean;
}

const AUDIT_STEPS = [
  { id: 1, label: 'Pre-check',    icon: ShieldCheck },
  { id: 2, label: 'Post charges', icon: Zap },
  { id: 3, label: 'Reconcile',    icon: BarChart2 },
  { id: 4, label: 'Roll date',    icon: Lock },
  { id: 5, label: 'Reports',      icon: FileText },
];

function getActiveStep(auditState: string): number {
  if (auditState === 'COMPLETED' || auditState === 'COMPLETED_WITH_EXCEPTIONS') return 5;
  if (auditState === 'IN_PROGRESS' || auditState === 'POSTING') return 2;
  return 1;
}

type Tone = 'amber' | 'emerald' | 'sky' | 'rose' | 'indigo';

const TONE: Record<Tone, {
  pill: string; dot: string; accent: string;
  btnVariant: 'primary' | 'danger' | 'success' | 'warning';
  aura: string;
}> = {
  amber: {
    pill: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200',
    dot: '#f59e0b',
    accent: '#f59e0b',
    btnVariant: 'warning',
    aura: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(245,158,11,0.10) 0%, transparent 65%)',
  },
  emerald: {
    pill: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200',
    dot: '#10b981',
    accent: '#10b981',
    btnVariant: 'success',
    aura: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(16,185,129,0.10) 0%, transparent 65%)',
  },
  sky: {
    pill: 'border-sky-400/25 bg-sky-400/[0.08] text-sky-200',
    dot: '#38bdf8',
    accent: '#38bdf8',
    btnVariant: 'primary',
    aura: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(56,189,248,0.10) 0%, transparent 65%)',
  },
  rose: {
    pill: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200',
    dot: '#f43f5e',
    accent: '#f43f5e',
    btnVariant: 'danger',
    aura: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(244,63,94,0.12) 0%, transparent 65%)',
  },
  indigo: {
    pill: 'border-indigo-400/25 bg-indigo-400/[0.08] text-indigo-200',
    dot: '#818cf8',
    accent: '#818cf8',
    btnVariant: 'primary',
    aura: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(129,140,248,0.10) 0%, transparent 65%)',
  },
};

function AuditStepper({ auditState, tone }: { auditState: string; tone: Tone }) {
  const activeStep = getActiveStep(auditState);
  const isCompleted = auditState === 'COMPLETED' || auditState === 'COMPLETED_WITH_EXCEPTIONS';
  const running = auditState === 'IN_PROGRESS' || auditState === 'POSTING';
  const accent = TONE[tone].accent;

  return (
    <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label="Audit progress">
      {AUDIT_STEPS.map((step, i) => {
        const done = isCompleted || step.id < activeStep;
        const active = !isCompleted && step.id === activeStep;
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all"
              style={{
                background: active ? `${accent}12` : done ? `${accent}08` : 'transparent',
                border: active ? `1px solid ${accent}35` : '1px solid transparent',
              }}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className="flex h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: done ? accent : active ? `${accent}22` : 'rgba(255,255,255,0.05)',
                  boxShadow: active ? `0 0 0 1px ${accent}60, 0 0 8px ${accent}40` : undefined,
                }}
              >
                {done ? (
                  <CheckCircle2 className="h-3 w-3 text-slate-950" strokeWidth={3} />
                ) : active && running ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: accent }} />
                ) : (
                  <Icon className="h-2.5 w-2.5" style={{ color: active ? accent : '#475569' }} />
                )}
              </span>
              <span
                className="hidden truncate md:inline"
                style={{ color: active ? 'white' : done ? '#cbd5e1' : '#475569' }}
              >
                {step.label}
              </span>
            </div>
            {i < AUDIT_STEPS.length - 1 && (
              <span
                className="h-px min-w-[6px] flex-1 rounded-full"
                style={{ background: done ? `${accent}80` : 'rgba(255,255,255,0.07)' }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MetaChip({
  icon: Icon, label, value,
}: {
  icon: React.ElementType; label: string; value: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
      style={{
        borderColor: 'rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.025)',
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <div className="leading-tight">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p>
        <p className="text-[11.5px] font-semibold text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export function StatusBanner({
  data, isAuditInProgress, onOpenWizard, refreshing, managerMode = false,
}: StatusBannerProps) {
  const { data: session } = useSession();
  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const isReady = data.summary.blockers === 0 && data.canStartAudit && !isAuditInProgress;
  const auditRecord = data.activeAudit || data.currentAudit;
  const lastCompleted =
    data.lastCompletedAudit ||
    (['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS'].includes(data.currentAudit?.status || '')
      ? data.currentAudit
      : null);
  const owner = auditRecord?.runByStaff;
  const currentUserName = session?.user?.name || session?.user?.email || '';
  const ownerName = owner
    ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
    : auditRecord?.runBy
    ? currentUserName || 'Assigned auditor'
    : ['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS'].includes(auditRecord?.status || '')
    ? 'System'
    : currentUserName || 'Current auditor';

  let tone: Tone = 'amber';
  let statusText = 'Pending';
  let statusSub = 'Awaiting daily close';
  let StatusIcon: React.ElementType = Clock3;
  let pulse = false;

  if (data.auditState === 'COMPLETED') {
    tone = 'emerald'; statusText = 'Closed'; statusSub = 'Business day closed'; StatusIcon = CheckCircle2;
  } else if (data.auditState === 'COMPLETED_WITH_EXCEPTIONS') {
    tone = 'amber'; statusText = 'Closed w/ exceptions'; statusSub = 'Review reconciliation'; StatusIcon = ShieldAlert;
  } else if (isAuditInProgress) {
    tone = 'sky'; statusText = 'In Progress'; statusSub = 'Posting charges…'; StatusIcon = Loader2; pulse = true;
  } else if (data.auditState === 'OVERDUE') {
    tone = 'rose'; statusText = 'Overdue'; statusSub = 'Close immediately'; StatusIcon = AlertTriangle; pulse = true;
  } else if (isReady) {
    tone = 'indigo'; statusText = 'Ready'; statusSub = 'All clear to run'; StatusIcon = FileCheck2;
  }

  const ctaLabel =
    isAuditInProgress ? 'Resume Audit' :
    ['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS'].includes(data.auditState) ? 'View Report' :
    data.auditState === 'OVERDUE' ? 'Run Audit Now' :
    'Begin Audit';
  const startDisabled = !(data.canStartAudit || data.canResumeAudit) || refreshing;
  const t = TONE[tone];

  return (
    <section
      aria-labelledby="night-audit-heading"
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: `${t.aura}, linear-gradient(135deg, #030712 0%, #070F1E 100%)`,
        backdropFilter: 'blur(20px)',
        borderColor: `${t.accent}25`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 64px -16px rgba(0,0,0,0.75), 0 0 80px -30px ${t.accent}30`,
      }}
    >
      {/* Animated top accent line */}
      <span
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${t.accent}00, ${t.accent}, ${t.accent}70, ${t.accent}00)` }}
      />

      {/* Grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 24px)',
        }}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">

        {/* LEFT: Identity */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: `${t.accent}30`,
              background: `${t.accent}12`,
              boxShadow: `0 0 24px -8px ${t.accent}50`,
            }}
          >
            <MoonStar className="h-5 w-5" style={{ color: t.accent }} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1
                id="night-audit-heading"
                className="text-[18px] font-bold tracking-tight text-white"
              >
                Night Audit
              </h1>
              <PulsingBadge
                tone={
                  tone === 'emerald' ? 'emerald' :
                  tone === 'rose'    ? 'rose'    :
                  tone === 'sky'     ? 'sky'     :
                  tone === 'indigo'  ? 'indigo'  :
                  'amber'
                }
                label={statusText}
                animate={pulse}
              />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-400">
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-200">
                {format(businessDate, 'EEEE, dd MMM yyyy')}
              </span>
              <span className="text-slate-600">·</span>
              <span className="truncate">{data.property.name || 'Property'}</span>
              <span className="text-slate-600">·</span>
              <span style={{ color: tone === 'rose' ? TONE_HEX.rose : '#64748b' }}>
                {statusSub}
              </span>
            </p>
          </div>
        </div>

        {/* RIGHT: Meta + CTA */}
        <div className="flex flex-col gap-3 lg:items-end">
          {/* Meta chips */}
          <div className="hidden items-center gap-2 xl:flex">
            <MetaChip icon={UserRound} label="Auditor" value={ownerName} />
            <MetaChip
              icon={Timer}
              label="Started"
              value={
                auditRecord?.startedAt
                  ? format(new Date(auditRecord.startedAt), 'dd MMM, HH:mm')
                  : 'Not started'
              }
            />
            <MetaChip
              icon={History}
              label="Last Closed"
              value={
                lastCompleted?.completedAt
                  ? format(new Date(lastCompleted.completedAt), 'dd MMM, HH:mm')
                  : '—'
              }
            />
          </div>

          {/* CTA */}
          {!managerMode && (
            <GlowButton
              onClick={onOpenWizard}
              disabled={startDisabled}
              variant={
                tone === 'rose'   ? 'danger'  :
                tone === 'emerald'? 'success' :
                tone === 'amber'  ? 'warning' :
                'primary'
              }
              size="md"
            >
              {isAuditInProgress ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              {ctaLabel}
              <ChevronRight className="h-3.5 w-3.5 opacity-70" />
            </GlowButton>
          )}
        </div>
      </div>

      {/* ── Bottom tier: stepper + counters ──────────────────────────────── */}
      <div
        className="relative flex flex-col gap-3 border-t px-5 py-3 md:flex-row md:items-center md:gap-6"
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.20)',
        }}
      >
        <AuditStepper auditState={data.auditState} tone={tone} />
        <div className="flex shrink-0 items-center gap-2">
          {/* Blockers chip */}
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{
              borderColor: data.summary.blockers > 0 ? 'rgba(244,63,94,0.3)' : 'rgba(52,211,153,0.2)',
              background: data.summary.blockers > 0 ? 'rgba(244,63,94,0.07)' : 'rgba(52,211,153,0.05)',
            }}
          >
            <ShieldAlert
              className="h-3.5 w-3.5"
              style={{ color: data.summary.blockers > 0 ? TONE_HEX.rose : TONE_HEX.emerald }}
            />
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: data.summary.blockers > 0 ? TONE_HEX.rose : TONE_HEX.emerald }}
            >
              {data.summary.blockers}
            </span>
            <span className="text-[11px] font-medium text-slate-500">Blockers</span>
          </div>
          {/* Warnings chip */}
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{
              borderColor: data.summary.warnings > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.2)',
              background: data.summary.warnings > 0 ? 'rgba(251,191,36,0.07)' : 'rgba(52,211,153,0.05)',
            }}
          >
            <AlertTriangle
              className="h-3.5 w-3.5"
              style={{ color: data.summary.warnings > 0 ? TONE_HEX.amber : TONE_HEX.emerald }}
            />
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: data.summary.warnings > 0 ? TONE_HEX.amber : TONE_HEX.emerald }}
            >
              {data.summary.warnings}
            </span>
            <span className="text-[11px] font-medium text-slate-500">Warnings</span>
          </div>
        </div>
      </div>
    </section>
  );
}

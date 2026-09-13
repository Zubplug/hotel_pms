import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2, SlidersHorizontal, FileCheck2, Banknote, ShieldCheck,
  Check, MoonStar, AlertTriangle, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';
import { OperationsReview } from './audit-wizard-steps/operations-review';
import { SystemControlReview } from './audit-wizard-steps/system-control-review';
import { FinancialReview } from './audit-wizard-steps/financial-review';
import { CashControlReview } from './audit-wizard-steps/cash-control-review';

const STEPS = [
  { title: 'Operations',      desc: 'Arrivals, departures and room status',  Icon: Building2,        accent: 'from-sky-500/20 to-blue-500/10',    iconColor: 'text-sky-300',    iconBorder: 'border-sky-400/25',    iconBg: 'rgba(14,165,233,0.14)' },
  { title: 'System Control',  desc: 'POS sessions and financial sync',       Icon: SlidersHorizontal, accent: 'from-violet-500/20 to-purple-500/10', iconColor: 'text-violet-300', iconBorder: 'border-violet-400/25', iconBg: 'rgba(139,92,246,0.14)' },
  { title: 'Financial Review', desc: 'Folios, balances and rate checks',      Icon: FileCheck2,       accent: 'from-emerald-500/20 to-teal-500/10', iconColor: 'text-emerald-300', iconBorder: 'border-emerald-400/25', iconBg: 'rgba(16,185,129,0.14)' },
  { title: 'Cash Control',    desc: 'Handovers and bank deposits',           Icon: Banknote,         accent: 'from-amber-500/20 to-yellow-500/10', iconColor: 'text-amber-300',  iconBorder: 'border-amber-400/25',  iconBg: 'rgba(245,158,11,0.14)' },
  { title: 'Final Sign-off',  desc: 'Confirm readiness and roll the date',   Icon: ShieldCheck,      accent: 'from-indigo-500/20 to-violet-500/10', iconColor: 'text-indigo-300', iconBorder: 'border-indigo-400/25', iconBg: 'rgba(99,102,241,0.14)' },
];

interface AuditWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NightAuditData;
  onExecute: () => void;
  executing: boolean;
  onRefresh: () => void;
}

export function AuditWizard({ open, onOpenChange, data, onExecute, executing, onRefresh }: AuditWizardProps) {
  const [step, setStep] = useState(0);
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  const businessDate = data.businessDate ? new Date(data.businessDate) : new Date();
  const blockers = data.summary?.blockers || 0;
  const isLastStep = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleResolve = (actionType: string, item: any) => {
    setResolutionAction({ type: actionType as any, item });
  };
  const handleResolutionSuccess = () => {
    setResolutionAction(null);
    onRefresh();
  };

  const renderStepContent = () => {
    switch (step) {
      case 0: return <OperationsReview data={data} onResolve={handleResolve} />;
      case 1: return <SystemControlReview data={data} onResolve={handleResolve} />;
      case 2: return <FinancialReview data={data} onResolve={handleResolve} />;
      case 3: return <CashControlReview data={data} onResolve={handleResolve} />;
      case 4: return (
        <div className="flex flex-col items-center py-10 text-center">
          {/* Glow icon */}
          <div
            className="mb-8 flex h-24 w-24 items-center justify-center rounded-[28px] border border-indigo-400/25"
            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.20),rgba(124,58,237,0.14))', boxShadow: '0 0 48px rgba(99,102,241,0.25)' }}
          >
            <ShieldCheck className="h-11 w-11 text-indigo-300" />
          </div>
          <h3 className="text-3xl font-bold tracking-tight text-white">Ready to Close Business Day</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            You are about to close the business date for{' '}
            <span className="font-semibold text-indigo-300">{format(businessDate, 'dd MMM yyyy')}</span>.
            This will post room charges and roll the system date forward.
          </p>

          {blockers > 0 ? (
            <div className="mt-8 flex w-full max-w-lg items-start gap-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-5 text-left">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div>
                <h4 className="font-bold text-rose-200">Cannot Execute Audit</h4>
                <p className="mt-1 text-sm text-rose-300/80">
                  There are <strong>{blockers}</strong> unresolved blocking controls. Resolve them in the previous steps before continuing.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8 w-full max-w-sm">
              <button
                onClick={onExecute}
                disabled={executing}
                className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-8 py-4 text-base font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)', boxShadow: '0 0 32px rgba(99,102,241,0.35)' }}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
                <Zap className="h-5 w-5" />
                {executing ? 'Executing Audit…' : 'Execute Night Audit'}
              </button>
              <p className="mt-3 text-[11px] text-slate-600">This action is logged against your auditor session and cannot be undone.</p>
            </div>
          )}
        </div>
      );
      default: return null;
    }
  };

  const currentStep = STEPS[step];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="!flex !h-[calc(100vh-2rem)] !max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border-white/[0.08] p-0 shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
          style={{ background: '#060b18' }}
        >
          {/* ── Header ── */}
          <div
            className="relative shrink-0 overflow-hidden px-7 py-6"
            style={{ background: '#07090f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-600/10 blur-2xl" />

            <DialogHeader className="relative">
              <div className="flex items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/25"
                    style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.22),rgba(124,58,237,0.16))', boxShadow: '0 0 28px rgba(99,102,241,0.28)' }}
                  >
                    <MoonStar className="h-5 w-5 text-indigo-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/70">
                      <span>Night Audit</span>
                      <span className="text-slate-700">/</span>
                      <span>Control Flow</span>
                    </div>
                    <DialogTitle className="mt-0.5 text-xl font-bold text-white">Close Business Day</DialogTitle>
                    <DialogDescription className="mt-0.5 hidden text-sm text-slate-500 sm:block">
                      Complete each control before posting charges and rolling the date.
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-right sm:block">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Business Date</p>
                  <p className="mt-1 font-mono text-sm font-bold text-indigo-300">{format(businessDate, 'dd MMM yyyy')}</p>
                </div>
              </div>
            </DialogHeader>

            {/* Progress bar */}
            <div className="relative mt-5 flex items-center gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#6366f1,#a78bfa)' }}
                />
              </div>
              <span className="w-10 text-right text-[11px] font-bold tabular-nums text-slate-500">
                {step + 1} / {STEPS.length}
              </span>
            </div>
          </div>

          {/* ── Main layout ── */}
          <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[280px_1fr]">

            {/* ── Sidebar ── */}
            <div
              className="flex min-h-0 flex-col overflow-hidden border-r border-white/[0.06]"
              style={{ background: '#07090f' }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-1.5">
                  {STEPS.map((item, idx) => {
                    const { Icon } = item;
                    const isActive = step === idx;
                    const isCompleted = step > idx;
                    return (
                      <button
                        key={item.title}
                        onClick={() => setStep(idx)}
                        className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left text-sm transition-all duration-200 ${
                          isActive
                            ? 'text-white shadow-lg'
                            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                        }`}
                        style={isActive ? {
                          background: `linear-gradient(135deg, ${item.accent.replace('from-', '').replace(' to-', ', ')})`,
                          border: `1px solid ${item.iconBorder.replace('border-', '').replace('/25', '')}26`,
                        } : { border: '1px solid transparent' }}
                      >
                        {/* Active glow line */}
                        {isActive && (
                          <span
                            className="absolute inset-y-[12px] left-0 w-[3px] rounded-full"
                            style={{ background: 'linear-gradient(180deg,#818cf8,#a78bfa)', boxShadow: '0 0 8px rgba(129,140,248,0.8)' }}
                          />
                        )}

                        {/* Icon badge */}
                        <span
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
                            isCompleted
                              ? 'border-emerald-400/25 bg-emerald-400/15 text-emerald-300'
                              : isActive
                              ? `${item.iconBorder} ${item.iconColor}`
                              : 'border-white/[0.06] bg-white/[0.03] text-slate-600 group-hover:text-slate-400'
                          }`}
                          style={isActive ? { background: item.iconBg } : undefined}
                        >
                          {isCompleted
                            ? <Check className="h-3.5 w-3.5" />
                            : <Icon className="h-3.5 w-3.5" />
                          }
                        </span>

                        <span className="relative z-10 min-w-0 flex-1">
                          <b className="block truncate text-[13px]">{idx + 1}. {item.title}</b>
                          <small className="mt-0.5 block truncate text-[10px] leading-relaxed opacity-70">{item.desc}</small>
                        </span>

                        {isActive && <ChevronRight className="relative z-10 h-3.5 w-3.5 shrink-0 opacity-60" />}
                      </button>
                    );
                  })}
                </div>

                {/* Audit protocol note */}
                <div
                  className="mt-5 rounded-2xl border border-indigo-400/15 p-4"
                  style={{ background: 'rgba(99,102,241,0.06)' }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-400/70">Audit Protocol</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-indigo-300/60">
                    Every close is recorded against the active auditor and business date for full accountability and compliance.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Content area ── */}
            <div className="flex min-w-0 flex-col overflow-hidden" style={{ background: '#060b18' }}>
              {/* Step header */}
              <div
                className="shrink-0 border-b border-white/[0.05] px-8 py-6"
                style={{ background: 'rgba(255,255,255,0.015)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${currentStep.iconColor} ${currentStep.iconBorder}`}
                    style={{ background: currentStep.iconBg }}
                  >
                    Step {String(step + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Control Review</span>
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">{currentStep.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{currentStep.desc}</p>
              </div>

              {/* Step content */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-7 md:p-8 pb-12">
                <div
                  className="min-h-full rounded-2xl border border-white/[0.06] p-6 md:p-8"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  {renderStepContent()}
                </div>
              </div>

              {/* Footer navigation */}
              <div
                className="flex shrink-0 items-center justify-between border-t border-white/[0.05] px-8 py-5"
                style={{ background: 'rgba(255,255,255,0.015)' }}
              >
                <button
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.07] hover:text-slate-200 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                {!isLastStep && (
                  <button
                    onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-400/30 px-5 text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ResolutionManager
        action={resolutionAction}
        onClose={() => setResolutionAction(null)}
        onSuccess={handleResolutionSuccess}
      />
    </>
  );
}

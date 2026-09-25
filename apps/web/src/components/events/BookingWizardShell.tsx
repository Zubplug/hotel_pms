'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Step = { id: number; title: string; description: string; icon: LucideIcon };

export function BookingWizardShell({
  steps,
  currentStepIndex,
  isSubmitting,
  canContinue,
  onBack,
  onNext,
  onSubmit,
  summary,
  children,
}: {
  steps: Step[];
  currentStepIndex: number;
  isSubmitting: boolean;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  summary: Array<{ label: string; value: string }>;
  children: ReactNode;
}) {
  const current = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eadfd8] bg-[#fffdfb] shadow-[0_18px_50px_rgba(65,32,19,0.08)]">
      <div className="grid lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-[#eadfd8] bg-[#24130d] p-4 text-white lg:border-b-0 lg:p-5">
          <div className="mb-5 hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300 lg:flex">
            <ShieldCheck className="h-4 w-4" /> Production workflow
          </div>
          <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const active = index === currentStepIndex;
              const complete = index < currentStepIndex;
              return <div key={step.id} className={`flex min-w-[126px] items-center gap-3 rounded-xl px-3 py-2.5 transition lg:min-w-0 ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-950/20' : 'text-orange-100/55'}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${complete ? 'border-emerald-300 bg-emerald-500 text-white' : active ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5'}`}>{complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
                <div className="text-left"><p className={`whitespace-nowrap text-xs font-semibold ${active ? 'text-white' : ''}`}>{step.title}</p><p className="hidden text-[10px] opacity-65 lg:block">{step.description}</p></div>
              </div>;
            })}
          </div>
        </aside>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4 border-b border-[#eadfd8] px-5 py-4 sm:px-7">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">Step {currentStepIndex + 1} of {steps.length}</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#24130d]">{current.title}</h2><p className="mt-1 text-xs text-[#947d72]">{current.description}</p></div>
            <div className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 sm:block">Availability checked on submit</div>
          </div>
          <div className="grid min-h-[360px] gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_230px]">
            <div className="min-w-0">{children}</div>
            <aside className="hidden rounded-xl border border-[#eadfd8] bg-[#fff8f2] p-4 lg:block"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#947d72]">Booking snapshot</p><div className="mt-4 space-y-3">{summary.map((item) => <div key={item.label}><p className="text-[10px] text-[#947d72]">{item.label}</p><p className="mt-0.5 truncate text-xs font-semibold text-[#3d2318]">{item.value}</p></div>)}</div><div className="mt-5 border-t border-[#eadfd8] pt-3 text-[10px] leading-4 text-[#947d72]">Your booking is saved atomically only after all hall and equipment conflicts pass.</div></aside>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#eadfd8] bg-white px-5 py-4 sm:px-7"><Button variant="outline" onClick={onBack} disabled={currentStepIndex === 0 || isSubmitting}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>{isLastStep ? <Button onClick={onSubmit} disabled={isSubmitting || !canContinue} className="bg-[#c2410c] hover:bg-[#9a3412]">{isSubmitting ? 'Creating booking…' : 'Confirm & schedule'} <Check className="ml-2 h-4 w-4" /></Button> : <Button onClick={onNext} disabled={!canContinue}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>}</div>
        </div>
      </div>
    </div>
  );
}

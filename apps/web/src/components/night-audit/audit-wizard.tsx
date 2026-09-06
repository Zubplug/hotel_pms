import React, { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, ShieldCheck, Check, MoonStar, AlertTriangle } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';

import { OperationsReview } from './audit-wizard-steps/operations-review';
import { SystemControlReview } from './audit-wizard-steps/system-control-review';
import { FinancialReview } from './audit-wizard-steps/financial-review';
import { CashControlReview } from './audit-wizard-steps/cash-control-review';

const steps = [
  { title: 'Operations', description: 'Arrivals, departures and room status', icon: Building2 },
  { title: 'System control', description: 'POS sessions and financial sync', icon: SlidersHorizontal },
  { title: 'Financial review', description: 'Folios, balances and rate checks', icon: FileCheck2 },
  { title: 'Cash control', description: 'Handovers and bank deposits', icon: Banknote },
  { title: 'Final sign-off', description: 'Confirm readiness and roll the date', icon: ShieldCheck },
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
  
  // Calculate blockers per step to show warning icons in the sidebar
  const blockers = data.summary?.blockers || 0;
  
  const handleResolve = (actionType: string, item: any) => {
    setResolutionAction({ type: actionType as any, item });
  };

  const handleResolutionSuccess = () => {
    setResolutionAction(null);
    onRefresh(); // Refresh data to clear resolved items
  };

  const isLastStep = step === steps.length - 1;

  // Function to render the correct step component
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return <OperationsReview data={data} onResolve={handleResolve} />;
      case 1:
        return <SystemControlReview data={data} onResolve={handleResolve} />;
      case 2:
        return <FinancialReview data={data} onResolve={handleResolve} baseCurrency={data.property.baseCurrency} />;
      case 3:
        return <CashControlReview data={data} onResolve={handleResolve} baseCurrency={data.property.baseCurrency} />;
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ready to Close Business Day</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                You are about to close the business date for {format(businessDate, 'dd MMM yyyy')}. This will post room charges and roll the system date forward.
              </p>
              
              {blockers > 0 ? (
                <div className="mt-8 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-left flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-rose-800 dark:text-rose-400">Cannot execute audit</h4>
                    <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">There are {blockers} unresolved blocking controls. You must resolve them in the previous steps before continuing.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]"
                    onClick={onExecute}
                    disabled={executing || blockers > 0}
                  >
                    {executing ? 'Executing...' : 'Execute Night Audit'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!flex !h-[calc(100vh-2rem)] !max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl p-0 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          
          {/* Header */}
          <div className="bg-slate-950 px-7 py-6 text-white shrink-0">
            <DialogHeader>
              <div className="flex items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-300">
                    <MoonStar className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                      <span>Night audit</span>
                      <span className="text-slate-600">/</span>
                      <span>Control flow</span>
                    </div>
                    <DialogTitle className="text-2xl font-semibold text-white">Close business day</DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-slate-400 hidden sm:block">
                      Complete each control before posting charges and rolling the date.
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right sm:block">
                  <p className="text-xs text-slate-400">Business date</p>
                  <p className="mt-1 font-semibold">{format(businessDate, 'dd MMM yyyy')}</p>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-6 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div 
                  className="h-full rounded-full bg-indigo-400 transition-all duration-300 ease-in-out" 
                  style={{ width: `${((step + 1) / steps.length) * 100}%` }} 
                />
              </div>
              <span className="text-xs font-medium text-slate-400 shrink-0 w-12 text-right">
                {step + 1} of {steps.length}
              </span>
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[320px_1fr]">
            
            {/* Sidebar */}
            <div className="overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-6">
              {steps.map((item, index) => {
                const Icon = item.icon;
                const isActive = step === index;
                const isCompleted = step > index;
                
                return (
                  <button 
                    key={item.title} 
                    onClick={() => setStep(index)} 
                    className={`mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm transition-all duration-200 ${
                      isActive 
                        ? 'bg-indigo-100 font-medium text-indigo-900 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100 ring-1 ring-indigo-200 dark:ring-indigo-500/30' 
                        : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800 hover:shadow-sm'
                    }`}
                  >
                    <span className={`rounded-xl p-2.5 shadow-sm transition-colors ${
                      isActive 
                        ? 'bg-indigo-600 text-white' 
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <b className="block truncate">{index + 1}. {item.title}</b>
                      <small className="mt-0.5 block leading-4 opacity-80 truncate">{item.description}</small>
                    </span>
                  </button>
                );
              })}
              
              <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Audit protocol</p>
                <p className="mt-2 text-xs leading-5 text-indigo-900/70 dark:text-indigo-200/70">
                  Every close is recorded against the active auditor and business date for accountability.
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex min-w-0 flex-col overflow-y-auto bg-white dark:bg-slate-950 p-7 md:p-10">
              <div className="shrink-0 mb-8">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                    STEP {String(step + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Control review
                  </span>
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {steps[step].title}
                </h3>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  {steps[step].description}
                </p>
              </div>
              
              <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-7">
                {renderStepContent()}
              </div>

              {/* Navigation Footer */}
              <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  Previous Step
                </Button>
                
                {!isLastStep && (
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
                  >
                    Continue
                  </Button>
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

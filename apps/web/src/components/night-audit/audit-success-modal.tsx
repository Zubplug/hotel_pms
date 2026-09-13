import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle, Sparkles, FileText, Check, Activity, ArrowRight, Home } from 'lucide-react';
import { format } from 'date-fns';

export interface AuditSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: any;
  businessDate: string;
}

export function AuditSuccessModal({ open, onOpenChange, result, businessDate }: AuditSuccessModalProps) {
  if (!result) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#060b18]/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0a0c1a] shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          
          {/* Background Glow */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[80px]" />

          <div className="relative px-8 pb-8 pt-10 text-center">
            
            {/* Success Icon */}
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.2)]">
              <Sparkles className="absolute right-2 top-2 h-4 w-4 text-emerald-300 opacity-60" />
              <CheckCircle className="h-10 w-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            </div>

            <Dialog.Title className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Audit Successful
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-slate-400">
              The Night Audit has been completed successfully. The business date has been rolled over and reports have been generated.
            </Dialog.Description>

            {/* Metrics Grid */}
            <div className="mt-8 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Room Charges
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {result.roomChargesPosted || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Successfully posted
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Activity className="h-3.5 w-3.5 text-indigo-400" />
                  Housekeeping
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {result.tasksCreated || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Tasks scheduled
                </div>
              </div>
            </div>

            {/* Date transition */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Previous</span>
                <span className="mt-1 text-sm font-semibold text-white">
                  {businessDate ? format(new Date(businessDate), 'MMM d, yyyy') : '...'}
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04]">
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Current</span>
                <span className="mt-1 text-sm font-bold text-indigo-300">
                  {businessDate ? format(new Date(new Date(businessDate).getTime() + 86400000), 'MMM d, yyyy') : '...'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => onOpenChange(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.05] py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.08]"
              >
                <Home className="h-4 w-4" />
                Return to Dashboard
              </button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = '/night-audit/reports';
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 py-3.5 text-sm font-bold text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.1)] transition-colors hover:bg-emerald-400/20"
              >
                <FileText className="h-4 w-4" />
                View Reports
              </button>
            </div>
            
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

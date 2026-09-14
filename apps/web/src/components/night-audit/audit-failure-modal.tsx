import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';

interface AuditFailureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onRetry: () => void;
}

export function AuditFailureModal({ open, onOpenChange, message, onRetry }: AuditFailureModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="!max-w-lg overflow-hidden rounded-[24px] border border-white/[0.08] !bg-[#0a0c1a] !p-0 shadow-2xl">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/20 blur-[80px]" />

        <div className="relative px-8 pb-8 pt-10 text-center">
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-rose-400/30 bg-rose-400/10 shadow-[0_0_40px_rgba(251,113,133,0.2)]">
            <AlertTriangle className="h-10 w-10 text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]" />
          </div>

          <DialogTitle className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Audit Failed
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm text-slate-400">
            The Night Audit was not completed. The business date remains unchanged and the audit can be retried after resolving the error.
          </DialogDescription>

          <div className="mt-8 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Failure reason</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-rose-100">{message || 'The audit could not be completed.'}</p>
          </div>

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
                onRetry();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 py-3.5 text-sm font-bold text-rose-300 transition-colors hover:bg-rose-400/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry Audit
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

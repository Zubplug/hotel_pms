'use client';

import { CheckCircle2, XCircle, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export type EmployeePortalFeedback = { type: 'success' | 'error' | 'info'; title: string; message: string };

export function EmployeePortalFeedbackDialog({ feedback, onClose }: { feedback: EmployeePortalFeedback | null; onClose: () => void }) {
  const success = feedback?.type === 'success';
  const error = feedback?.type === 'error';
  const Icon = success ? CheckCircle2 : error ? XCircle : Info;
  if (!feedback) return null;
  return (
    <Dialog open={Boolean(feedback)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden rounded-2xl border-slate-800 bg-[#0b1624] p-0 text-slate-100 shadow-2xl shadow-black/40">
        <div className={`h-1 w-full ${success ? 'bg-emerald-400' : error ? 'bg-rose-400' : 'bg-cyan-400'}`} />
        <div className="p-6">
          <DialogHeader className="items-center text-center">
            <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${success ? 'bg-emerald-400/15 text-emerald-300' : error ? 'bg-rose-400/15 text-rose-300' : 'bg-cyan-400/15 text-cyan-300'}`}><Icon className="h-7 w-7" /></div>
            <DialogTitle className="text-base font-bold text-white">{feedback.title}</DialogTitle>
            <DialogDescription className="pt-1 text-center text-xs leading-5 text-slate-400">{feedback.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 sm:justify-center"><Button type="button" onClick={onClose} className="h-9 min-w-28 gap-2 bg-teal-600 text-xs text-white hover:bg-teal-500">Continue <ArrowRight className="h-3.5 w-3.5" /></Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

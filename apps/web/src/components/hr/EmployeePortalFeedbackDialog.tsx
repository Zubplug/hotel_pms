'use client';

import { CheckCircle2, XCircle, Info, ArrowRight, Sparkles } from 'lucide-react';
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
        <div className="relative p-6 pt-7">
          <div className={`pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full blur-3xl ${success ? 'bg-emerald-400/15' : error ? 'bg-rose-400/15' : 'bg-cyan-400/15'}`} />
          <DialogHeader className="items-center text-center">
            <div className={`relative mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] ring-1 ${success ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-300/20' : error ? 'bg-rose-400/15 text-rose-300 ring-rose-300/20' : 'bg-cyan-400/15 text-cyan-300 ring-cyan-300/20'}`}><Icon className="h-8 w-8" /><Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 opacity-70" /></div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${success ? 'text-emerald-300' : error ? 'text-rose-300' : 'text-cyan-300'}`}>{success ? 'Action complete' : error ? 'Action needed' : 'Portal update'}</p>
            <DialogTitle className="text-base font-bold text-white">{feedback.title}</DialogTitle>
            <DialogDescription className="pt-1 text-center text-xs leading-5 text-slate-400">{feedback.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 sm:justify-center"><Button type="button" onClick={onClose} className="h-9 min-w-28 gap-2 bg-teal-600 text-xs text-white hover:bg-teal-500">Continue <ArrowRight className="h-3.5 w-3.5" /></Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

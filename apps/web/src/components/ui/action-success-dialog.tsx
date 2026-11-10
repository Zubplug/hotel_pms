'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ActionSuccessDetail = {
  title: string;
  description?: string;
};

const SUCCESS_EVENT = 'lodgecore:action-success';

export function showActionSuccess(detail: ActionSuccessDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ActionSuccessDetail>(SUCCESS_EVENT, { detail }));
  }
}

export function ActionSuccessDialog() {
  const [success, setSuccess] = useState<ActionSuccessDetail | null>(null);

  useEffect(() => {
    const handleSuccess = (event: Event) => {
      setSuccess((event as CustomEvent<ActionSuccessDetail>).detail);
    };
    window.addEventListener(SUCCESS_EVENT, handleSuccess);
    return () => window.removeEventListener(SUCCESS_EVENT, handleSuccess);
  }, []);

  return (
    <Dialog open={!!success} onOpenChange={(open) => !open && setSuccess(null)}>
      <DialogContent className="overflow-hidden rounded-[28px] border-0 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-md">
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pb-8 pt-8 text-center text-white">
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="absolute right-4 top-4 rounded-full p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Close success message"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-8 ring-white/10">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2.2} />
          </div>
          <DialogTitle className="mt-5 text-2xl font-bold tracking-tight text-white">{success?.title}</DialogTitle>
          <DialogDescription className="mx-auto mt-2 max-w-sm text-sm leading-6 text-emerald-50">
            {success?.description}
          </DialogDescription>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button onClick={() => setSuccess(null)} className="min-w-24 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

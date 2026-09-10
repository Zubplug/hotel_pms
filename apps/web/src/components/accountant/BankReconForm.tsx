"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function BankReconForm() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleStartRecon = async () => {
    setIsSubmitting(true);
    try {
      // Dummy endpoint call, normally this would initiate a reconciliation process
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Bank reconciliation process initiated');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error('Failed to start reconciliation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-100 rounded-lg text-sm transition-colors border border-white/10">
        Reconcile
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>Start Bank Reconciliation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-400">
            This will fetch the latest bank feeds and attempt to auto-match with open cash drops and POS deposits. Do you want to proceed?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-300 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleStartRecon} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? 'Starting...' : 'Start Reconciliation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

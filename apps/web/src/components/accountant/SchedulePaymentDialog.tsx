"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SchedulePaymentDialog({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const [open, setOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/accountant/payables/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, scheduledDate: new Date(scheduledDate).toISOString(), type: 'SCHEDULED' })
      });
      if (!res.ok) throw new Error('Failed to schedule payment');
      
      toast.success('Payment scheduled successfully');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Error scheduling payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-3 py-1 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg text-sm transition-colors border border-amber-500/20">
        Schedule Payment
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Invoice Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSchedule} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Amount to Pay (₦)</Label>
            <Input type="number" readOnly value={amount} className="bg-slate-950 border-white/10 text-white opacity-70" />
          </div>
          <div className="space-y-2">
            <Label>Execution Date</Label>
            <Input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

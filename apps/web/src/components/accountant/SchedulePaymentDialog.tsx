"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SchedulePaymentDialog({ invoiceId, amount, currency = 'NGN' }: { invoiceId: string; amount: number; currency?: string }) {
  const [open, setOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [bankReference, setBankReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/accountant/payables/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: { amount, paymentDate: new Date(`${scheduledDate}T12:00:00`).toISOString(), paymentMethod, bankReference: bankReference || undefined } })
      });
      if (!res.ok) throw new Error('Failed to schedule payment');
      
      toast.success('Supplier payment recorded');
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
            <Label>Amount to Pay ({currency})</Label>
            <Input type="number" readOnly value={amount} className="bg-slate-950 border-white/10 text-white opacity-70" />
          </div>
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-slate-950 border-white/10 text-white [color-scheme:dark]" />
          </div>
          <div className="space-y-2"><Label>Payment method</Label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white"><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></div>
          <div className="space-y-2"><Label>Bank / payment reference</Label><Input value={bankReference} onChange={e => setBankReference(e.target.value)} placeholder="Optional reference" className="bg-slate-950 border-white/10 text-white" /></div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isSubmitting ? 'Posting...' : 'Post Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

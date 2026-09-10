"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MatchPaymentModal({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/accountant/city-ledger/${accountId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), reference })
      });
      if (!res.ok) throw new Error('Failed to record payment');
      
      toast.success('Payment matched successfully');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Error recording payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-3 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm transition-colors border border-emerald-500/20">
        Match Payment
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-slate-50 max-w-sm">
        <DialogHeader>
          <DialogTitle>Match Incoming Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleMatch} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Amount (₦)</Label>
            <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-slate-950 border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label>Bank Reference / Teller Number</Label>
            <Input required value={reference} onChange={(e) => setReference(e.target.value)} className="bg-slate-950 border-white/10 text-white" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Processing...' : 'Confirm Match'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

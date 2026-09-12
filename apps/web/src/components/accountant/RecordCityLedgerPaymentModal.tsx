"use client";

import React, { useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function RecordCityLedgerPaymentModal({ accountId, accountName, balance, currency }: { accountId: string; accountName: string; balance: number; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > balance) {
      toast.error(`Enter a payment between 0 and ${balance.toFixed(2)}`);
      return;
    }
    if (!reference.trim()) {
      toast.error('Payment reference is required for reconciliation');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/accountant/city-ledger/${accountId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount, reference: reference.trim() }),
      });
      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.error?.message || body.error || 'Unable to record payment');
      toast.success('City-ledger payment recorded');
      setOpen(false);
      setReference('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-500" />}><Receipt className="mr-1.5 h-3.5 w-3.5" />Record payment</DialogTrigger>
      <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader><DialogTitle>Record AR payment</DialogTitle><DialogDescription className="text-slate-400">Apply a reconciled payment to {accountName}. The balance cannot be over-settled.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor={`payment-amount-${accountId}`} className="text-sm text-slate-300">Amount ({currency})</label><Input id={`payment-amount-${accountId}`} type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 border-white/10 bg-slate-950 text-white" /></div>
          <div><label htmlFor={`payment-reference-${accountId}`} className="text-sm text-slate-300">Payment reference</label><Input id={`payment-reference-${accountId}`} placeholder="Bank reference or receipt number" value={reference} onChange={event => setReference(event.target.value)} className="mt-1 border-white/10 bg-slate-950 text-white" /></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-transparent text-slate-300">Cancel</Button><Button type="submit" disabled={submitting} className="bg-indigo-600 text-white hover:bg-indigo-500">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm payment</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

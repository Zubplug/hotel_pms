'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GuestCreditRefundDialog({ entryId, guestName, amount, currency }: { entryId: string; guestName: string; amount: number; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [method, setMethod] = useState('ORIGINAL_PAYMENT');
  const [reason, setReason] = useState('Guest requested refund of available folio credit');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/guest-credits/${entryId}/refund-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(value), refundMethod: method, reason, bankName, bankAccountName, bankAccountNumber, idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to submit refund request');
      toast.success('Refund request submitted for approval');
      setOpen(false);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to submit refund request'); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger><Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500"><Banknote className="mr-1.5 h-3.5 w-3.5" />Request refund</Button></DialogTrigger><DialogContent className="border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-lg"><form onSubmit={submit}><DialogHeader><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Wallet className="h-5 w-5" /></div><DialogTitle className="text-white">Refund guest credit</DialogTitle><DialogDescription className="text-slate-400">Submit {currency} {amount.toLocaleString()} for {guestName}. Approval is required before money leaves the hotel.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="grid gap-2"><Label>Refund amount ({currency})</Label><Input type="number" min="0.01" max={amount} step="0.01" value={value} onChange={event => setValue(event.target.value)} required className="border-white/10 bg-white/[.05] text-white" /></div><div className="grid gap-2"><Label>Settlement method</Label><select value={method} onChange={event => setMethod(event.target.value)} className="h-10 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white"><option value="ORIGINAL_PAYMENT">Original payment method</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash office</option></select></div>{method === 'BANK_TRANSFER' && <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><Input placeholder="Bank name" value={bankName} onChange={event => setBankName(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /><Input placeholder="Account name" value={bankAccountName} onChange={event => setBankAccountName(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /><Input placeholder="Account number" value={bankAccountNumber} onChange={event => setBankAccountNumber(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /></div>}<div className="grid gap-2"><Label>Reason</Label><Input value={reason} onChange={event => setReason(event.target.value)} required className="border-white/10 bg-white/[.05] text-white" /></div><p className="text-xs leading-5 text-slate-500">Posting on settlement: Dr 2160 Guest Refunds Payable · Cr the selected cash, bank, or original-payment clearing account.</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-transparent text-slate-300">Cancel</Button><Button type="submit" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-500">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for approval</Button></DialogFooter></form></DialogContent></Dialog>;
}

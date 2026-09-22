'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function GuestCreditRefundDialog({ entryId, guestName, amount, currency, guestId, propertyId }: { entryId: string; guestName: string; amount: number; currency: string; guestId?: string; propertyId?: string }) {
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [method, setMethod] = useState(guestId ? 'BANK_TRANSFER' : 'ORIGINAL_PAYMENT');
  const [reason, setReason] = useState('Guest requested refund of available folio credit');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (method === 'BANK_TRANSFER' && (!bankName.trim() || !bankAccountName.trim() || !/^\d{6,20}$/.test(bankAccountNumber.replace(/\s+/g, '')))) {
        throw new Error('Enter a valid bank name, account name, and 6–20 digit account number.');
      }
      const payload = { cityLedgerEntryId: entryId, guestId, propertyId, amount: Number(value), currency, refundMethod: method, reason, bankName, bankAccountName, bankAccountNumber, idempotencyKey: crypto.randomUUID() };
      const result = guestId && propertyId
        ? await provider.refunds.request(payload)
        : await (async () => { const response = await fetch(`/api/v1/accountant/guest-credits/${entryId}/refund-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to submit refund request'); return body; })();
      toast.success((result as any)?.pendingSync || !isOnline ? 'Refund request queued offline and will sync for approval' : 'Refund request submitted for approval');
      setOpen(false);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to submit refund request'); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" />}><Banknote className="mr-1.5 h-3.5 w-3.5" />Request refund</DialogTrigger><DialogContent className="border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-lg"><form onSubmit={submit}><DialogHeader><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Wallet className="h-5 w-5" /></div><DialogTitle className="text-white">Refund guest credit</DialogTitle><DialogDescription className="text-slate-400">Submit {currency} {amount.toLocaleString()} for {guestName}. An Accountant and then a Manager must approve before money leaves the hotel.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="grid gap-2"><Label>Refund amount ({currency})</Label><Input type="number" min="0.01" max={amount} step="0.01" value={value} onChange={event => setValue(event.target.value)} required className="border-white/10 bg-white/[.05] text-white" /></div><div className="grid gap-2"><Label>Settlement method</Label><select value={method} onChange={event => setMethod(event.target.value)} className="h-10 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white"><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash office</option>{!guestId && <option value="ORIGINAL_PAYMENT">Original payment method</option>}</select></div>{method === 'BANK_TRANSFER' && <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><Input placeholder="Bank name" value={bankName} onChange={event => setBankName(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /><Input placeholder="Account name" value={bankAccountName} onChange={event => setBankAccountName(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /><Input placeholder="Account number" value={bankAccountNumber} onChange={event => setBankAccountNumber(event.target.value)} required className="border-white/10 bg-slate-950 text-white" /></div>}<div className="grid gap-2"><Label>Reason</Label><Input value={reason} onChange={event => setReason(event.target.value)} required className="border-white/10 bg-white/[.05] text-white" /></div><p className="text-xs leading-5 text-slate-500">Settlement posts Dr Guest Refunds Payable and credits the selected cash or bank account.</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-transparent text-slate-300">Cancel</Button><Button type="submit" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-500">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for approval</Button></DialogFooter></form></DialogContent></Dialog>;
}

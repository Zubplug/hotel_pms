'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, CheckCircle2, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Label } from '@/components/ui/label';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { generateUUID } from '@/lib/utils';

export function GuestCreditRefundDialog({ entryId, guestName, amount, currency, guestId, propertyId, accountType = 'GUEST_CREDIT' }: { entryId: string; guestName: string; amount: number; currency: string; guestId?: string; propertyId?: string; accountType?: 'GUEST_CREDIT' | 'CORPORATE_ADVANCE' }) {
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amount));
  const isCorporateAdvance = accountType === 'CORPORATE_ADVANCE';
  const [method, setMethod] = useState(isCorporateAdvance || guestId ? 'BANK_TRANSFER' : 'ORIGINAL_PAYMENT');
  const [reason, setReason] = useState(isCorporateAdvance ? 'Corporate requested refund of unapplied advance' : 'Guest requested refund of available folio credit');
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
      const payload = { cityLedgerEntryId: entryId, guestId, propertyId, accountType: isCorporateAdvance ? 'CORPORATE' : undefined, amount: Number(value), currency, refundMethod: method, reason, bankName, bankAccountName, bankAccountNumber, idempotencyKey: generateUUID() };
      const result = propertyId
        ? await provider.refunds.request(payload)
        : await (async () => { const response = await fetch(`/api/v1/accountant/guest-credits/${entryId}/refund-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to submit refund request'); return body; })();
      toast.success((result as any)?.pendingSync || !isOnline ? 'Refund request queued offline and will sync for approval' : 'Refund request submitted for approval');
      setOpen(false);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to submit refund request'); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button size="sm" className="rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" />}>
      <Banknote className="mr-1.5 h-3.5 w-3.5" />Request refund
    </DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl sm:max-w-lg">
      <form onSubmit={submit}>
        <DialogHeader className="border-b border-slate-200 bg-white px-6 pb-5 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Request guest-credit refund</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-5 text-slate-500">
                Submit a refund request for {isCorporateAdvance ? 'the corporate advance account' : guestName}. The Accountant and Manager must approve it before settlement.
              </DialogDescription>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Available guest credit</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{guestName}</p>
            </div>
            <p className="text-lg font-extrabold text-emerald-700">{currency} {amount.toLocaleString()}</p>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-2">
            <Label className="font-semibold text-slate-700">Refund amount ({currency})</Label>
            <AmountInput min="0.01" max={amount} value={value} onValueChange={setValue} required className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500/20" />
          </div>

          <div className="grid gap-2">
            <Label className="font-semibold text-slate-700">Refund method</Label>
            <select value={method} onChange={event => setMethod(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10">
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash office</option>
              {!guestId && <option value="ORIGINAL_PAYMENT">Original payment method</option>}
            </select>
          </div>

          {method === 'BANK_TRANSFER' && <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Banknote className="h-4 w-4 text-emerald-600" />Bank details</div>
            <p className="text-xs text-slate-500">These details will be visible to the Accountant and Manager during approval.</p>
            <Input aria-label="Bank name" placeholder="Bank name" value={bankName} onChange={event => setBankName(event.target.value)} required className="h-11 border-slate-200 bg-slate-50 text-slate-900" />
            <Input aria-label="Account name" placeholder="Account name" value={bankAccountName} onChange={event => setBankAccountName(event.target.value)} required className="h-11 border-slate-200 bg-slate-50 text-slate-900" />
            <Input aria-label="Account number" placeholder="Account number" inputMode="numeric" value={bankAccountNumber} onChange={event => setBankAccountNumber(event.target.value)} required className="h-11 border-slate-200 bg-slate-50 text-slate-900" />
          </div>}

          <div className="grid gap-2">
            <Label className="font-semibold text-slate-700">Reason for refund</Label>
            <Input value={reason} onChange={event => setReason(event.target.value)} required className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500/20" />
          </div>

          <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div><p className="font-bold">Two-step approval</p><p className="mt-0.5 text-xs leading-5 text-blue-700">The request is queued for the Accountant first, then the Manager. No money is paid from this screen.</p></div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />The guest-credit balance remains auditable until the refund is finally settled.</p>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Cancel</Button>
          <Button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 font-bold text-white shadow-sm hover:bg-emerald-700">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for approval</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

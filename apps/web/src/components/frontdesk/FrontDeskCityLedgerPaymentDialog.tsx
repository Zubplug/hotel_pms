'use client';

import { useState } from 'react';
import { Landmark, Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Label } from '@/components/ui/label';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function FrontDeskCityLedgerPaymentDialog({ entry, onComplete }: { entry: any; onComplete: () => Promise<any> | void }) {
  const { provider, isOnline } = useLodgeCoreProvider();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [amount, setAmount] = useState(String(Number(entry.outstandingAmount || 0)));
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const isCorporate = entry.accountType === 'CORPORATE';
  const isAdvance = entry.entryKind === 'CORPORATE_ACCOUNT';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || (!isAdvance && numericAmount > Number(entry.outstandingAmount) + 0.01)) {
      toast.error(isAdvance ? 'Enter a positive advance amount.' : 'Enter an amount within the outstanding balance.');
      return;
    }
    if (!reference.trim()) {
      toast.error('Payment reference is required.');
      return;
    }
    setBusy(true);
    try {
      const result = isAdvance
        ? await provider.cityLedger.advance({ accountId: entry.accountId, amount: numericAmount, method, reference: reference.trim() })
        : await provider.cityLedger.settle({ entryId: entry.entryId, accountId: entry.accountId, invoiceId: isCorporate ? undefined : entry.invoiceId, accountType: entry.accountType, amount: numericAmount, method, reference: reference.trim() });
      toast.success((result as any)?.pendingSync || !isOnline ? 'City ledger payment queued offline' : 'City ledger payment posted');
      setOpen(false);
      await onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to post city ledger payment');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className={isCorporate ? 'rounded-xl bg-blue-600 font-bold text-white shadow-sm hover:bg-blue-700' : 'rounded-xl bg-indigo-600 font-bold text-white shadow-sm hover:bg-indigo-700'} />}>
      <ReceiptText className="mr-1.5 h-4 w-4" />{isAdvance ? 'Receive corporate advance' : isCorporate ? 'Post corporate payment' : 'Settle invoice'}
    </DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl sm:max-w-lg">
      <form onSubmit={submit}>
        <DialogHeader className="border-b border-slate-200 bg-white px-6 pb-5 pt-6">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isCorporate ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}><Landmark className="h-5 w-5" /></div>
            <div>
            <DialogTitle className="text-xl font-bold text-slate-900">{isAdvance ? 'Receive corporate advance' : isCorporate ? 'Post corporate account payment' : 'Settle walk-out invoice'}</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-5 text-slate-500">{isAdvance ? 'Receive funds before an invoice exists. The amount remains as an unapplied corporate advance for later allocation.' : isCorporate ? 'Record a payment against this corporate account. The system applies it FIFO to open invoices.' : 'Record an individual payment against this walk-out invoice.'}</DialogDescription>
            </div>
          </div>
          <div className={`mt-5 flex items-center justify-between rounded-2xl border px-4 py-3 ${isCorporate ? 'border-blue-200 bg-blue-50' : 'border-indigo-200 bg-indigo-50'}`}>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isCorporate ? 'Corporate account' : 'Invoice reference'}</p><p className="mt-1 font-semibold text-slate-800">{isCorporate ? entry.accountName : (entry.invoiceNumber || entry.entryId.slice(0, 8))}</p></div>
            <div className="text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isAdvance ? 'Current balance' : 'Outstanding'}</p><p className={`mt-1 text-lg font-extrabold ${isCorporate ? 'text-blue-700' : 'text-indigo-700'}`}>{entry.currency || 'NGN'} {Number(entry.outstandingAmount).toLocaleString()}</p></div>
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-2"><Label className="font-semibold text-slate-700">{isAdvance ? 'Advance amount' : 'Payment amount'} ({entry.currency || 'NGN'})</Label><AmountInput min="0.01" max={isAdvance ? undefined : entry.outstandingAmount} value={amount} onValueChange={setAmount} required className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20" /></div>
          <div className="grid gap-2"><Label className="font-semibold text-slate-700">Payment method</Label><select value={method} onChange={event => setMethod(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash office</option><option value="POS">POS</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select></div>
          <div className="grid gap-2"><Label className="font-semibold text-slate-700">Receipt / payment reference</Label><Input value={reference} onChange={event => setReference(event.target.value)} placeholder="Enter receipt or transfer reference" required className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20" /></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">This payment is recorded against the active Front Desk shift. {isCorporate ? 'Corporate payments are automatically allocated to the oldest open invoices first.' : 'This payment settles only the selected invoice.'}</div>
        </div>
        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl border-slate-200 bg-white text-slate-700">Cancel</Button><Button type="submit" disabled={busy} className={isCorporate ? 'rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700' : 'rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700'}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post payment</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

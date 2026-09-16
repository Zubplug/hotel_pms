'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Banknote, CheckCircle2, Loader2, Upload } from 'lucide-react';

type BankAccount = { id: string; name: string; bankName?: string | null; accountNumber?: string | null };

export function SubmitAvailableCashButton({ propertyId, availableAmount }: { propertyId: string; availableAmount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState(availableAmount.toFixed(2));
  const [bankReference, setBankReference] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(availableAmount.toFixed(2));
    fetch(`/api/v1/financial-control/bank-accounts?propertyId=${encodeURIComponent(propertyId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load bank accounts');
        setAccounts(body.data || []);
        setBankAccountId(body.data?.[0]?.id || '');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load bank accounts'));
  }, [open, propertyId, availableAmount]);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > availableAmount + 0.005) {
      setError(`Enter an amount between ₦0.01 and ₦${availableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
      return;
    }
    if (!bankAccountId) { setError('Select the receiving bank account.'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/v1/financial-control/deposits/submit-available', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, amount: value, bankAccountId, bankReference: bankReference.trim() || undefined, bankReceiptUrl: receiptUrl.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit cash');
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit cash');
    } finally { setLoading(false); }
  };

  return <>
    <Button onClick={() => { setError(''); setSuccess(false); setOpen(true); }} className="gap-2 rounded-xl bg-emerald-600 font-semibold shadow-sm hover:bg-emerald-700">
      <Upload className="h-4 w-4" /> Submit available cash
    </Button>
    <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
      <DialogContent className="rounded-2xl border-slate-200 sm:max-w-lg">
        {success ? <>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Cash submitted successfully</DialogTitle><DialogDescription>The submitted amount is recorded as a bank deposit. No cashier or operational shift was changed.</DialogDescription></DialogHeader>
          <DialogFooter><Button onClick={() => { setOpen(false); router.refresh(); }}>Done</Button></DialogFooter>
        </> : <>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-lg"><Banknote className="h-5 w-5 text-emerald-600" />Submit cash to bank</DialogTitle><DialogDescription>Submit any amount currently available to the General Cashier. This creates one finance-tracked bank deposit.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Available cashier funds</p><p className="mt-1 text-xl font-black text-slate-950">₦{availableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div><Banknote className="h-6 w-6 text-emerald-600" /></div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Amount to submit<Input type="number" min="0.01" max={availableAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 rounded-xl text-base" /></label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Receiving bank account<select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select configured bank account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.bankName || 'Bank'}{account.accountNumber ? ` · ${account.accountNumber}` : ''}</option>)}</select></label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Bank reference <span className="font-normal normal-case text-slate-400">(optional)</span><Input value={bankReference} onChange={(event) => setBankReference(event.target.value)} placeholder="Receipt or transfer reference" className="mt-1.5 rounded-xl" /></label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Notes <span className="font-normal normal-case text-slate-400">(optional)</span><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the finance team" className="mt-1.5 rounded-xl" /></label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Receipt URL <span className="font-normal normal-case text-slate-400">(optional)</span><Input value={receiptUrl} onChange={(event) => setReceiptUrl(event.target.value)} placeholder="Secure receipt link" className="mt-1.5 rounded-xl" /></label>
            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={loading || !bankAccountId} className="gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Submitting…' : 'Confirm bank submission'}</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}

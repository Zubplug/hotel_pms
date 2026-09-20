'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Upload, BadgeCheck } from 'lucide-react';

type DialogState = 'submit' | 'verify' | 'success' | 'error' | null;

export function DepositActionButton({
  depositId,
  propertyId,
  currentStatus,
  allowSubmit = false,
}: {
  depositId: string;
  propertyId: string;
  currentStatus: string;
  allowSubmit?: boolean;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [bankReference, setBankReference] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; name: string; bankName?: string | null; accountNumber?: string | null }>>([]);
  const [bankReceiptUrl, setBankReceiptUrl] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const openSubmit = async () => {
    setDialog('submit');
    try {
      const response = await fetch(`/api/v1/financial-control/bank-accounts?propertyId=${encodeURIComponent(propertyId)}`);
      const body = await response.json();
      if (response.ok) {
        setBankAccounts(body.data || []);
        setBankAccountId((body.data || [])[0]?.id || '');
      }
    } catch { /* The submit dialog will show the validation error if unavailable. */ }
  };

  if (currentStatus === 'PENDING_HANDOVER' && !allowSubmit) return null;
  if (!['PENDING_HANDOVER', 'DEPOSITED'].includes(currentStatus)) return null;

  const submit = async () => {
    setLoading(true);
    try {
      const response =
        currentStatus === 'PENDING_HANDOVER'
          ? await fetch(`/api/v1/financial-control/deposits/${depositId}/submit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bankReference: bankReference.trim() || undefined,
                bankAccountId: bankAccountId || undefined,
                bankReceiptUrl: bankReceiptUrl.trim() || undefined,
              }),
            })
          : await (async () => {
              const start = await fetch(
                `/api/v1/financial-control/deposits/${depositId}/verify`,
                { method: 'POST' }
              );
              if (!start.ok) return start;
              return fetch(`/api/v1/financial-control/deposits/${depositId}/verify`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bankConfirmedAmount: Number(confirmedAmount),
                  notes: notes.trim() || undefined,
                }),
              });
            })();

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to complete deposit action');
      setDialog('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete deposit action');
      setDialog('error');
    } finally {
      setLoading(false);
    }
  };

  const isSubmit = currentStatus === 'PENDING_HANDOVER';

  return (
    <>
      <Button
        size="sm"
        variant={isSubmit ? 'default' : 'outline'}
        disabled={loading}
        onClick={() => isSubmit ? openSubmit() : setDialog('verify')}
        className={isSubmit
          ? 'gap-1.5 text-xs font-semibold'
          : 'gap-1.5 border-emerald-400/30 bg-emerald-400/10 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-100'}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isSubmit ? (
          <Upload className="h-3.5 w-3.5" />
        ) : (
          <BadgeCheck className="h-3.5 w-3.5" />
        )}
        {isSubmit ? 'Submit to Bank' : 'Reconcile'}
      </Button>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && !loading && setDialog(null)}
      >
        <DialogContent className="rounded-2xl border-slate-200 sm:max-w-lg">
          {dialog === 'submit' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-indigo-600" />Submit deposit to bank</DialogTitle>
                <DialogDescription>
                  Confirm that the physical cash has been deposited. Enter the bank receipt or reference number if available.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-indigo-900">Confirm the receiving bank account and record the bank evidence before submitting this deposit.</div>
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Receiving bank account<select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Select configured bank account</option>
                    {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.accountNumber ? ` · ${account.accountNumber}` : ''}</option>)}
                  </select></label>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Bank reference<Input value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="Bank reference or receipt number" className="mt-1.5 rounded-xl" /></label>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Receipt evidence <span className="font-normal normal-case text-slate-400">(optional)</span><Input value={bankReceiptUrl} onChange={(e) => setBankReceiptUrl(e.target.value)} placeholder="Secure receipt URL" className="mt-1.5 rounded-xl" /></label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={loading || !bankAccountId} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Submitting…' : 'Confirm Submission'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'verify' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg"><BadgeCheck className="h-5 w-5 text-emerald-600" />Reconcile bank deposit</DialogTitle>
                <DialogDescription>
                  Enter the amount confirmed by the bank. Any difference will be flagged as an exception for investigation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Enter the amount confirmed by the bank. Any difference will remain visible as an exception until it is explained.</div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Bank-confirmed amount<Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 rounded-xl"
                /></label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Reconciliation notes <span className="font-normal normal-case text-slate-400">(optional)</span><Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document any difference or verification notes"
                  className="mt-1.5 rounded-xl"
                /></label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={
                    loading ||
                    confirmedAmount === '' ||
                    Number.isNaN(Number(confirmedAmount))
                  }
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Reconciling…' : 'Confirm Reconciliation'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Action Completed
                </DialogTitle>
                <DialogDescription>
                  {isSubmit
                    ? 'The deposit is now marked as deposited with the bank.'
                    : 'The bank deposit has been reconciled successfully.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setDialog(null);
                    router.refresh();
                  }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle>Action Failed</DialogTitle>
                <DialogDescription>{message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setDialog(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  currentStatus,
}: {
  depositId: string;
  currentStatus: string;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [bankReference, setBankReference] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        onClick={() => setDialog(isSubmit ? 'submit' : 'verify')}
        className="gap-1.5 text-xs font-semibold"
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
        <DialogContent className="sm:max-w-md">
          {dialog === 'submit' && (
            <>
              <DialogHeader>
                <DialogTitle>Submit Deposit to Bank</DialogTitle>
                <DialogDescription>
                  Confirm that the physical cash has been deposited. Enter the bank receipt or reference number if available.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Input
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder="Bank reference / receipt number (optional)"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Submitting…' : 'Confirm Submission'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'verify' && (
            <>
              <DialogHeader>
                <DialogTitle>Reconcile Bank Deposit</DialogTitle>
                <DialogDescription>
                  Enter the amount confirmed by the bank. Any difference will be flagged as an exception for investigation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  placeholder="Bank-confirmed amount"
                />
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reconciliation notes (optional)"
                />
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

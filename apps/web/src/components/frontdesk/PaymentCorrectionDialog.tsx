'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

const methods = [
  ['CASH', 'Cash'],
  ['POS', 'POS terminal'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['CARD', 'Card'],
] as const;

export function PaymentCorrectionDialog({ open, onOpenChange, payment, onSubmitted }: { open: boolean; onOpenChange: (open: boolean) => void; payment: any; onSubmitted?: () => void }) {
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState(() => String(payment?.amount ?? ''));
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: correctionStatus, isLoading: loadingExisting } = useQuery({
    queryKey: ['payment-correction', payment?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/frontdesk/payments/${payment.id}/correction`);
      if (!response.ok) throw new Error('Unable to load correction status');
      const result = await response.json();
      return result?.data || result;
    },
    enabled: open && !!payment?.id && !isDesktopMode,
  });
  const existing = correctionStatus?.correction || null;
  const canApprove = Boolean(correctionStatus?.canApprove);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const correctedAmount = Number(amount);
    if (!Number.isFinite(correctedAmount) || correctedAmount <= 0 || reason.trim().length < 10) return;
    setSubmitting(true);
    try {
      const payload = { correctedMethod: method || payment.method, correctedAmount, reason: reason.trim(), supportingReference: reference.trim() || undefined, idempotencyKey: `PAYMENT_CORRECTION_REQUEST:${payment.id}` };
      const result = isDesktopMode
        ? await provider.folios.requestPaymentCorrection?.(payment.id, payload)
        : await (async () => {
            const response = await fetch(`/api/v1/frontdesk/payments/${payment.id}/correction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            return { ok: response.ok, ...(await response.json()) };
          })();
      if (!result || result.ok === false || result.success === false) throw new Error(result?.error?.message || result?.error || 'Unable to request correction');
      toast.success('Correction request submitted for manager approval.');
      onSubmitted?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Unable to request correction');
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!existing?.id) return;
    const rejectionReason = decision === 'REJECT' ? reason.trim() : '';
    if (decision === 'REJECT' && rejectionReason.length < 10) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/frontdesk/payments/${payment.id}/correction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: rejectionReason }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error?.message || result.error || 'Unable to update correction');
      toast.success(decision === 'APPROVE' ? 'Payment method corrected and posted.' : 'Correction request rejected.');
      onSubmitted?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Unable to update correction');
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Correct payment</DialogTitle>
        <DialogDescription>The original receipt remains in the audit history. You may correct the amount, payment method, or both. A manager must approve the correction.</DialogDescription>
      </DialogHeader>
      {loadingExisting ? <div className="py-8 text-center text-sm text-muted-foreground">Checking correction status…</div> : existing ? <div className="space-y-5">
        <div className="rounded-xl border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">Correction request: {existing.status.replaceAll('_', ' ')}</p>
          <p className="mt-1 text-muted-foreground">Requested method: {existing.originalMethod} → {existing.correctedMethod}</p>
          <p className="mt-1 text-muted-foreground">Requested amount: {existing.amount} {existing.currency} → {existing.correctedAmount} {existing.currency}</p>
          <p className="mt-1 text-muted-foreground">Reason: {existing.reason}</p>
        </div>
        {canApprove && existing.status === 'REQUESTED' && <>
          <div className="space-y-2"><Label>Rejection reason <span className="text-muted-foreground">(required only to reject)</span></Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} placeholder="Explain why this correction should not be posted." /></div>
          <div className="flex gap-3"><Button type="button" className="flex-1" disabled={submitting} onClick={() => decide('APPROVE')}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Approve and post</Button><Button type="button" variant="outline" className="flex-1" disabled={submitting || reason.trim().length < 10} onClick={() => decide('REJECT')}>Reject</Button></div>
        </>}
      </div> : <form onSubmit={submit} className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{payment.amount} {payment.currency} recorded as <strong>{payment.method}</strong>.</span></div>
        </div>
        <div className="space-y-2"><Label>Correct amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm"><span className="font-medium">{payment.method}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><select value={method} onChange={(event) => setMethod(event.target.value)} className="h-9 flex-1 rounded-md border bg-background px-3"><option value="">Keep current method</option>{methods.filter(([value]) => value !== payment.method).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} placeholder="Explain why the original payment method was incorrect." required /></div>
        <div className="space-y-2"><Label>Supporting reference <span className="text-muted-foreground">(optional)</span></Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="POS approval code or bank transfer reference" /></div>
        <Button type="submit" className="w-full" disabled={submitting || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || (!method && Math.abs(Number(amount) - Number(payment.amount)) < 0.005) || reason.trim().length < 10}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for approval</Button>
      </form>}
    </DialogContent>
  </Dialog>;
}

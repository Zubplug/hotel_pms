'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export function RefundDialog({ open, onOpenChange, folio, paymentId }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any, paymentId: string }) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const payment = folio?.payments?.find((p: any) => p.id === paymentId);
  const maxRefundable = payment ? Number(payment.amount) - (payment.refunds || []).reduce((sum: number, r: any) => sum + (r.status !== 'FAILED' ? Number(r.amount) : 0), 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      if (numAmount > maxRefundable) {
        throw new Error(`Cannot refund more than the remaining refundable amount (${maxRefundable})`);
      }

      const res = await fetch(`/api/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          reason,
          idempotencyKey: globalThis.crypto.randomUUID()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process refund');

      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      onOpenChange(false);
      setAmount('');
      setReason('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Refunding Payment #{payment.id.slice(0,8).toUpperCase()} ({payment.method})
          </DialogDescription>
        </DialogHeader>

        {error && <div className="p-3 bg-red-100 text-red-800 text-sm rounded-md">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Refund Amount ({folio?.currency})</Label>
            <Input 
              type="number" 
              step="0.01" 
              max={maxRefundable}
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">Maximum refundable: {maxRefundable}</p>
          </div>

          <div className="space-y-2">
            <Label>Reason for Refund</Label>
            <Textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Guest cancelled, overcharged, etc."
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Process Refund
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

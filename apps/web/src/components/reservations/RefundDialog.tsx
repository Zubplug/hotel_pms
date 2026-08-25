'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function RefundDialog({ open, onOpenChange, folio, paymentId }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any, paymentId: string }) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('MANUAL_ADJUSTMENT');
  const [refundMethod, setRefundMethod] = useState('ORIGINAL_PAYMENT');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();

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

      const res = await provider.refunds.request({
          paymentId,
          propertyId: folio.propertyId,
          reservationId: folio.reservationId,
          folioId: folio.id,
          amount: numAmount,
          reason,
          category,
          refundMethod,
          bankAccountName,
          bankAccountNumber,
          bankName,
          bankCode,
          idempotencyKey: generateUUID()
      });
      if (!res?.success && res?.error) throw new Error(res.error || 'Failed to process refund');

      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      onOpenChange(false);
      setAmount('');
      setReason('');
      setCategory('MANUAL_ADJUSTMENT');
      setRefundMethod('ORIGINAL_PAYMENT');
      setBankAccountName(''); setBankAccountNumber(''); setBankName(''); setBankCode('');
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
            <Label>Refund Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isSubmitting} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
              <option value="RESERVATION_CANCELLED">Reservation cancelled</option>
              <option value="REDUCED_STAY">Reduced stay</option>
              <option value="FOLIO_CREDIT_BALANCE">Folio credit balance</option>
              <option value="DUPLICATE_PAYMENT">Duplicate payment</option>
              <option value="SERVICE_FAILURE">Service failure</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Refund Method</Label>
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} disabled={isSubmitting} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              <option value="ORIGINAL_PAYMENT">Original payment method</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </select>
          </div>
          {refundMethod === 'BANK_TRANSFER' && <div className="grid grid-cols-2 gap-3 rounded-md border p-3"><Input placeholder="Account name" value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} required /><Input placeholder="Account number" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} required /><Input placeholder="Bank name" value={bankName} onChange={e => setBankName(e.target.value)} required /><Input placeholder="Bank code (optional)" value={bankCode} onChange={e => setBankCode(e.target.value)} /></div>}

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

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import crypto from 'crypto'; // We will use uuid or crypto for idempotency on client side... wait, crypto in browser? We can use `crypto.randomUUID()`.

export function AddPaymentDialog({ open, onOpenChange, folio }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any }) {
  const [method, setMethod] = useState<string>('CASH');
  const [amount, setAmount] = useState<string>(folio?.balance > 0 ? folio.balance.toString() : '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      if (numAmount > Number(folio.balance)) {
        throw new Error('Payment amount cannot exceed the outstanding balance');
      }

      const isGateway = method === 'PAYMENT_GATEWAY';
      const endpoint = isGateway ? '/api/v1/payments/online/initialize' : '/api/v1/payments';
      
      const payload = isGateway ? {
        folioId: folio.id,
        amount: numAmount,
        currency: folio.currency
      } : {
        folioId: folio.id,
        amount: numAmount,
        currency: folio.currency,
        method,
        notes,
        idempotencyKey: crypto.randomUUID()
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process payment');

      if (isGateway && data.data?.authorizationUrl) {
        // Redirect to Paystack checkout
        window.location.href = data.data.authorizationUrl;
        return;
      }

      // Success for manual payment
      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      onOpenChange(false);
      setMethod('CASH');
      setNotes('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>
            Process a payment for Folio #{folio?.id?.slice(0,8)?.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        {error && <div className="p-3 bg-red-100 text-red-800 text-sm rounded-md">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(val) => setMethod(val || 'CASH')} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="POS">POS Terminal</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="CARD">Manual Card</SelectItem>
                <SelectItem value="PAYMENT_GATEWAY">Online Payment (Paystack)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount ({folio?.currency})</Label>
            <Input 
              type="number" 
              step="0.01" 
              max={folio?.balance}
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">Outstanding balance: {folio?.balance}</p>
          </div>

          {method !== 'PAYMENT_GATEWAY' && (
            <div className="space-y-2">
              <Label>Reference / Notes</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder={method === 'POS' ? 'Enter POS receipt number...' : 'Optional notes...'}
                disabled={isSubmitting}
                required={method === 'POS'}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {method === 'PAYMENT_GATEWAY' ? 'Initialize Payment' : 'Process Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

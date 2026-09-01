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
import { generateUUID } from '@/lib/utils';

export function AddPaymentDialog({ open, onOpenChange, folio, collectionSource = 'FRONT_DESK' }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any, collectionSource?: string }) {
  const [method, setMethod] = useState<string>('CASH');
  const [amount, setAmount] = useState<string>(folio?.balance > 0 ? folio.balance.toString() : '');
  const [notes, setNotes] = useState('');
  const [auditOverrideReason, setAuditOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPaymentId, setSuccessPaymentId] = useState<string | null>(null);
  
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
        currency: folio.currency,
        ...(auditOverrideReason.trim() ? { nightAuditOverrideReason: auditOverrideReason.trim() } : {})
      } : {
        folioId: folio.id,
        amount: numAmount,
        currency: folio.currency,
        method,
        notes,
        idempotencyKey: generateUUID()
        ,collectionSource,
        ...(auditOverrideReason.trim() ? { nightAuditOverrideReason: auditOverrideReason.trim() } : {})
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to process payment');

      if (isGateway && data.data?.authorizationUrl) {
        // Redirect to Paystack checkout
        window.location.href = data.data.authorizationUrl;
        return;
      }

      // Success for manual payment
      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      setSuccessPaymentId(data.data.payment.id);
      // We do not close the dialog automatically.
    } catch (err: any) {
      const message = err.message || 'Failed to process payment';
      setError(message.includes('Night audit') || message.includes('NIGHT_AUDIT')
        ? `${message} Supervisors may enter an override reason below.`
        : message);
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
        {error?.includes('override reason') && <div className="space-y-2"><Label>Supervisor override reason</Label><Textarea value={auditOverrideReason} onChange={(e) => setAuditOverrideReason(e.target.value)} placeholder="Explain why this guest payment must be processed during audit (minimum 10 characters)" disabled={isSubmitting} /></div>}

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
                <SelectItem value="CITY_LEDGER">City Ledger / Direct Bill</SelectItem>
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

        {successPaymentId && (
          <div className="absolute inset-0 bg-background flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-lg z-50">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-semibold">Payment Successful</h3>
            <p className="text-muted-foreground text-sm">
              The payment of {folio?.currency} {amount} has been successfully recorded.
            </p>
            <div className="flex flex-col gap-2 w-full pt-4">
              <Button onClick={() => window.open(`/payments/${successPaymentId}/receipt`, '_blank')} variant="default" className="w-full">
                View / Print Receipt
              </Button>
              <Button onClick={() => { setSuccessPaymentId(null); onOpenChange(false); setMethod('CASH'); setAmount(''); setNotes(''); }} variant="outline" className="w-full">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

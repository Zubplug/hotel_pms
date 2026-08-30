import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { VarianceReasonCode } from '@hotel-pms/db';

interface CashHandoverResolutionProps {
  propertyId: string;
  baseCurrency: string;
  handover: any;
  onSuccess: () => void;
  onClose: () => void;
}

export function CashHandoverResolution({ propertyId, baseCurrency, handover, onSuccess, onClose }: CashHandoverResolutionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actualAmount, setActualAmount] = useState<string>(handover.amount.toString());
  const [notes, setNotes] = useState('');
  const [reasonCode, setReasonCode] = useState<VarianceReasonCode | ''>('');

  const expectedAmount = Number(handover.amount);
  const received = Number(actualAmount || 0);
  const variance = received - expectedAmount;

  const handleAccept = async () => {
    if (variance !== 0 && !reasonCode) {
      setError('A reason code is required when there is a cash variance.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/v1/night-audit/resolve/cash-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          handoverId: handover.id,
          actualAmount: received,
          notes,
          reasonCode: variance !== 0 ? reasonCode : null,
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to accept handover');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Receive Cash Handover</DialogTitle>
          <DialogDescription>
            Verify and accept physical cash from the handover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg border">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Handover Ref</p>
              <p className="font-semibold">{handover.handoverReference || handover.id.split('-')[0]}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium mb-1">From Cashier</p>
              <p className="font-semibold">{handover.handedOverBy?.firstName} {handover.handedOverBy?.lastName}</p>
            </div>
            <div className="col-span-2 mt-2 pt-2 border-t">
              <p className="text-muted-foreground font-medium mb-1">Expected Amount</p>
              <p className="text-xl font-bold">{formatCurrency(expectedAmount, baseCurrency)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Actual Cash Received</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">{baseCurrency}</span>
              <Input 
                type="number"
                step="0.01"
                min="0"
                className="pl-12 font-medium text-lg"
                value={actualAmount}
                onChange={e => setActualAmount(e.target.value)}
              />
            </div>
          </div>

          <div className={`flex justify-between items-center p-3 rounded-lg border ${variance === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
            <span className="font-medium text-slate-700">Variance:</span>
            <span className={`font-bold ${variance === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {variance > 0 ? '+' : ''}{formatCurrency(variance, baseCurrency)}
            </span>
          </div>

          {variance !== 0 && (
            <>
              <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>A variance of <strong>{formatCurrency(Math.abs(variance), baseCurrency)}</strong> ({variance > 0 ? 'Overage' : 'Shortage'}) has been detected. You must provide a reason.</p>
              </div>
              <div className="space-y-2">
                <Label>Variance Reason <span className="text-rose-500">*</span></Label>
                <Select value={reasonCode} onValueChange={(v: any) => setReasonCode(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH_COUNTING_ERROR">Cash Counting Error</SelectItem>
                    <SelectItem value="MISSING_RECEIPT">Missing Receipt</SelectItem>
                    <SelectItem value="UNAUTHORIZED_PAYOUT">Unauthorized Payout</SelectItem>
                    <SelectItem value="REFUND_ERROR">Refund Error</SelectItem>
                    <SelectItem value="WRONG_CHANGE">Wrong Change Given</SelectItem>
                    <SelectItem value="CASH_DROP_ERROR">Cash Drop Error</SelectItem>
                    <SelectItem value="TRANSFER_ERROR">Transfer Error</SelectItem>
                    <SelectItem value="SYSTEM_ERROR">System Error</SelectItem>
                    <SelectItem value="CUSTOMER_DISPUTE">Customer Dispute</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown / Unexplained</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea 
              placeholder="Add any additional details or context..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-20"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleAccept} disabled={loading || (variance !== 0 && !reasonCode)} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Accept Handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

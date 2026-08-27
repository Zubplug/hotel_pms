'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { getReducedStayEstimate } from '@/lib/refunds/reduced-stay';

export function FrontDeskRefundDialog({ open, onOpenChange, folio, reservation, paymentId, initialCategory = 'MANUAL_ADJUSTMENT' }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any, reservation: any, paymentId: string, initialCategory?: string }) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [reducedStayNightsInput, setReducedStayNightsInput] = useState('1');
  const [refundMethod, setRefundMethod] = useState('ORIGINAL_PAYMENT');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();

  const payment = folio?.payments?.find((p: any) => p.id === paymentId);
  const maxRefundable = payment ? Number(payment.amount) - (payment.refunds || []).reduce((sum: number, r: any) => sum + (r.status !== 'FAILED' ? Number(r.amount) : 0), 0) : 0;
  const roomChargeTotal = (folio?.items || []).filter((item: any) => item.source === 'ROOM_CHARGE' && item.type === 'CHARGE' && !item.voidedAt).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const reducedStay = getReducedStayEstimate({ checkIn: reservation?.checkIn, checkOut: reservation?.checkOut, status: reservation?.status, roomChargeTotal });
  const reducedStayNights = category === 'REDUCED_STAY' ? Math.min(reducedStay.availableNights, Math.max(0, Number(reducedStayNightsInput) || 0)) : 0;
  const reducedStayAmount = reducedStayNights * reducedStay.nightlyRoomAmount;

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
      if (category === 'REDUCED_STAY' && (reducedStayNights <= 0 || Math.abs(numAmount - reducedStayAmount) > 0.01)) {
        throw new Error('Select valid remaining nights for the reduced-stay refund');
      }

      const res = await provider.refunds.request({
          paymentId,
          propertyId: folio.propertyId,
          reservationId: folio.reservationId,
          folioId: folio.id,
          amount: numAmount,
          reason,
          category,
          reducedStayNights: category === 'REDUCED_STAY' ? reducedStayNights : undefined,
          refundMethod,
          bankAccountName,
          bankAccountNumber,
          bankName,
          bankCode,
          idempotencyKey: generateUUID()
      });
      if (!res?.success && res?.error) throw new Error(res.error?.message || res.error || 'Failed to process refund');

      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[760px] max-h-[calc(100vh-1rem)] p-0 overflow-hidden bg-slate-50/50 rounded-2xl flex flex-col">
        <div className="bg-white px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 relative shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <CornerDownRight className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Issue Refund</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  Reversing transaction for Payment <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">#{payment.id.slice(0,8).toUpperCase()}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {/* Max Refundable Chip */}
          <div className="relative mt-3 text-left sm:absolute sm:top-6 sm:right-6 sm:mt-0 sm:text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Refundable</p>
            <p className="font-black text-xl text-amber-600 tracking-tight">
              {folio?.currency} {maxRefundable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="min-h-0 px-4 sm:px-6 py-4 sm:py-6 bg-slate-50/50 relative overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <Label className="text-sm font-bold text-slate-700">Refund Amount ({folio?.currency})</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {folio?.currency}
                  </div>
                  <Input 
                    type="number" 
                    step="0.01" 
                    max={maxRefundable}
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    readOnly={category === 'REDUCED_STAY'}
                    disabled={isSubmitting}
                    required
                    autoFocus
                    className="h-14 pl-14 text-xl font-bold bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-amber-500"
                  />
                </div>
              </div>

              {category === 'REDUCED_STAY' && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm"><p>Available nights to reduce: <strong>{reducedStay.availableNights}</strong> of {reducedStay.totalNights}</p><Label>Nights to reduce</Label><Input type="number" min="1" max={reducedStay.availableNights} value={reducedStayNightsInput} onChange={(e) => { const value = Math.min(reducedStay.availableNights, Math.max(0, Number(e.target.value) || 0)); setReducedStayNightsInput(String(value)); setAmount((value * reducedStay.nightlyRoomAmount).toFixed(2)); }} disabled={isSubmitting} required /><p className="text-xs text-slate-500">Estimated refund: {folio?.currency} {reducedStayAmount.toFixed(2)} ({folio?.currency} {reducedStay.nightlyRoomAmount.toFixed(2)} per night)</p></div>}

              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-700">Refund Category</Label>
                <select value={category} onChange={(e) => { const value = e.target.value; setCategory(value); if (value === 'REDUCED_STAY') { setReducedStayNightsInput('1'); setAmount(reducedStay.nightlyRoomAmount.toFixed(2)); } }} disabled={isSubmitting} className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm">
                  <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
                  <option value="RESERVATION_CANCELLED">Reservation cancelled</option>
                  <option value="NO_SHOW">No-show refund</option>
                  <option value="REDUCED_STAY">Reduced stay</option>
                  <option value="FOLIO_CREDIT_BALANCE">Folio credit balance</option>
                  <option value="DUPLICATE_PAYMENT">Duplicate payment</option>
                  <option value="SERVICE_FAILURE">Service failure</option>
                </select>
              </div>

              <div className="space-y-3"><Label className="text-sm font-bold text-slate-700">Refund Method</Label><select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} disabled={isSubmitting} className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm"><option value="ORIGINAL_PAYMENT">Original payment method</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
              {refundMethod === 'BANK_TRANSFER' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4"><Input placeholder="Account name" value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} required /><Input placeholder="Account number" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} required /><Input placeholder="Bank name" value={bankName} onChange={e => setBankName(e.target.value)} required /><Input placeholder="Bank code (optional)" value={bankCode} onChange={e => setBankCode(e.target.value)} /></div>}

              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-700">Reason for Refund</Label>
                <Textarea 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  placeholder="e.g. Overcharged, Guest cancelled..."
                  disabled={isSubmitting}
                  required
                  className="min-h-[100px] resize-none rounded-xl border-slate-200 bg-white focus-visible:ring-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <DialogClose render={
                  <Button type="button" variant="outline" className="w-full sm:w-auto h-12 px-6 rounded-xl font-semibold border-slate-200" disabled={isSubmitting}>
                    Cancel
                  </Button>
                } />
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || Number(amount) <= 0}
                  className="w-full sm:w-auto h-12 px-8 rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <CornerDownRight className="w-5 h-5 mr-2" />
                  )}
                  Process Refund
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner relative">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-50 animate-ping"></div>
                <CheckCircle2 className="w-10 h-10 text-emerald-600 relative z-10" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Refund Request Submitted</h3>
                <p className="text-slate-500 mt-2 text-sm max-w-[280px] mx-auto">
                  The refund of <span className="font-bold text-slate-700">{folio?.currency} {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> is awaiting approval. No financial refund has been finalized yet.
                </p>
              </div>
              
              <div className="w-full max-w-sm space-y-3 pt-4">
                <Button 
                  onClick={() => { setSuccess(false); onOpenChange(false); setAmount(''); setReason(''); }} 
                  variant="outline" 
                  className="w-full h-14 rounded-xl font-bold border-slate-200 text-slate-600"
                >
                  Return to Reservation
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

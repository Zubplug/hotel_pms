'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CreditCard, Banknote, Landmark, Receipt, CheckCircle2, ChevronRight, AlertCircle, ArrowUpRight } from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';

export function FrontDeskAddPaymentDialog({ open, onOpenChange, folio }: { open: boolean, onOpenChange: (open: boolean) => void, folio: any }) {
  const [method, setMethod] = useState<string>('CASH');
  const [amount, setAmount] = useState<string>(folio?.balance > 0 ? folio.balance.toString() : '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPaymentId, setSuccessPaymentId] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<'IDLE' | 'PRINTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();

  const triggerPrint = async (paymentId: string) => {
    if (!HardwareBridge.isAvailable()) return;
    setPrintStatus('PRINTING');
    try {
      const res = await HardwareBridge.printPaymentReceipt({
        receiptNumber: paymentId,
        guestName: folio?.reservation?.primaryGuest?.firstName + ' ' + folio?.reservation?.primaryGuest?.lastName,
        roomNumber: folio?.reservation?.roomNumber || '',
        folioNumber: folio?.id || '',
        amountPaid: Number(amount),
        paymentMethod: method,
        paymentReference: notes,
        previousBalance: folio?.balance,
        remainingBalance: folio?.balance - Number(amount),
        cashierName: 'System',
        currency: folio?.currency || 'USD',
        propertyName: 'LodgeCore',
        printedAt: new Date().toISOString()
      });
      if (res.success) {
        setPrintStatus('SUCCESS');
      } else {
        toast.error(`Printer Error: ${res.error || 'Unknown error'}`);
        setPrintStatus('FAILED');
      }
    } catch (e: any) {
      toast.error(`Printer Error: ${e.message || String(e)}`);
      setPrintStatus('FAILED');
    }
  };

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
      
      let paymentId = null;

      if (isGateway) {
        const endpoint = '/api/v1/payments/online/initialize';
        const payload = {
          folioId: folio.id,
          amount: numAmount,
          currency: folio.currency
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to process payment gateway');

        if (data.data?.authorizationUrl) {
          window.location.href = data.data.authorizationUrl;
          return;
        }
        paymentId = data.data?.payment?.id;
      } else {
        const payload = {
          amount: numAmount,
          currency: folio.currency,
          method,
          notes,
          idempotencyKey: generateUUID()
        };

        const res = await provider.folios.addPayment(folio.id, payload);
        if (!res.success) {
           throw new Error(res.error?.message || res.error || 'Failed to record payment');
        }
        paymentId = res.data?.payment?.id || 'pending-sync';
      }

      await queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] });
      setSuccessPaymentId(paymentId);
      triggerPrint(paymentId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    { id: 'CASH', label: 'Cash', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
    { id: 'POS', label: 'POS Terminal', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
    { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
    { id: 'PAYMENT_GATEWAY', label: 'Paystack Online', icon: ArrowUpRight, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-slate-50/50 rounded-2xl flex flex-col max-h-[90vh]">
        <div className="bg-white px-6 pt-6 pb-4 border-b border-slate-100 relative shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Receive Payment</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  Process transaction for Folio <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">#{folio?.id?.slice(0,8)?.toUpperCase()}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {/* Balance Chip */}
          <div className="absolute top-6 right-6 text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Balance Due</p>
            <p className="font-black text-xl text-slate-800 tracking-tight">
              {folio?.currency} {folio?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="px-6 py-6 bg-slate-50/50 relative overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {!successPaymentId ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Payment Method Selector Grid */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-700">Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map((m) => {
                    const isSelected = method === m.id;
                    const Icon = m.icon;
                    return (
                      <div 
                        key={m.id}
                        onClick={() => !isSubmitting && setMethod(m.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 flex flex-col items-start gap-3 transition-all",
                          isSelected 
                            ? `border-${m.bg.split('-')[1]}-500 bg-white shadow-[0_0_0_2px] shadow-${m.bg.split('-')[1]}-100` 
                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300",
                          isSubmitting && "opacity-50 pointer-events-none"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", m.bg, m.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={cn("font-semibold text-sm", isSelected ? "text-slate-900" : "text-slate-600")}>
                          {m.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <Label className="text-sm font-bold text-slate-700">Amount Received ({folio?.currency})</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {folio?.currency}
                  </div>
                  <Input 
                    type="number" 
                    step="0.01" 
                    max={folio?.balance}
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    disabled={isSubmitting}
                    required
                    className="h-14 pl-14 text-xl font-bold bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Notes Input */}
              {method !== 'PAYMENT_GATEWAY' && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">
                    {method === 'POS' ? 'POS Receipt Number' : method === 'BANK_TRANSFER' ? 'Transfer Reference' : 'Additional Notes'}
                  </Label>
                  <Textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder={method === 'POS' ? 'e.g. 123456789' : 'Any details to record...'}
                    disabled={isSubmitting}
                    required={method === 'POS' || method === 'BANK_TRANSFER'}
                    className="min-h-[100px] resize-none rounded-xl border-slate-200 bg-white focus-visible:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <DialogClose render={
                  <Button type="button" variant="outline" className="h-12 px-6 rounded-xl font-semibold border-slate-200" disabled={isSubmitting}>
                    Cancel
                  </Button>
                } />
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || Number(amount) <= 0}
                  className="h-12 px-8 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : method === 'PAYMENT_GATEWAY' ? (
                    <ArrowUpRight className="w-5 h-5 mr-2" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                  )}
                  {method === 'PAYMENT_GATEWAY' ? 'Initialize Gateway' : 'Record Payment'}
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
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Successful</h3>
                <p className="text-slate-500 mt-2 text-sm max-w-[280px] mx-auto">
                  The payment of <span className="font-bold text-slate-700">{folio?.currency} {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> has been securely recorded to the folio.
                </p>
              </div>

              <div className="w-full max-w-sm mt-2 mb-4 p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-slate-600">
                  {printStatus === 'PRINTING' && 'Printing Payment Receipt...'}
                  {printStatus === 'SUCCESS' && 'Payment Receipt Printed'}
                  {printStatus === 'FAILED' && 'Printer Unavailable'}
                  {printStatus === 'IDLE' && 'Skipped Printing'}
                </p>
                {printStatus === 'FAILED' && successPaymentId && (
                  <Button variant="outline" size="sm" onClick={() => triggerPrint(successPaymentId)} className="h-8 text-xs rounded-full">
                    Retry Hardware Print
                  </Button>
                )}
              </div>
              
              <div className="w-full max-w-sm space-y-3 pt-4">
                {!HardwareBridge.isAvailable() && (
                  <Button 
                    onClick={() => window.open(`/frontdesk/payments/${successPaymentId}/receipt`, '_blank')} 
                    className="w-full h-14 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-lg flex items-center justify-between px-6"
                  >
                    <span className="flex items-center"><Receipt className="w-5 h-5 mr-3 text-slate-400" /> Print A4 Receipt</span>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </Button>
                )}
                <Button 
                  onClick={() => { setSuccessPaymentId(null); onOpenChange(false); }} 
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, HelpCircle, Receipt, ShieldCheck } from 'lucide-react';

interface TransactionVerificationResolutionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[]; // Combined unverified transactions
  propertyId: string;
  onSuccess?: () => void;
}

export function TransactionVerificationResolution({
  open,
  onOpenChange,
  transactions,
  propertyId,
  onSuccess,
}: TransactionVerificationResolutionProps) {
  const router = useRouter();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'VIEW' | 'QUESTION' | 'SUCCESS'>('VIEW');
  const [successType, setSuccessType] = useState<'VERIFIED' | 'QUESTIONED' | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setResolvedIds(new Set());
      setMode('VIEW');
      setNotes('');
      setSuccessType(null);
    }
  }, [open]);

  // Filter transactions to only those that are UNVERIFIED
  const unverifiedTransactions = transactions?.filter(t => t.verificationStatus === 'UNVERIFIED' && !resolvedIds.has(t.id)) || [];
  
  const handleClose = () => {
    setNotes('');
    setMode('VIEW');
    setSuccessType(null);
    setCurrentIndex(0);
    onOpenChange(false);
  };

  const handleContinue = () => {
    setNotes('');
    setSuccessType(null);
    setMode('VIEW');
    setCurrentIndex(0);
    if (unverifiedTransactions.length === 0) {
      onSuccess?.();
      handleClose();
    }
  };

  const transaction = unverifiedTransactions[currentIndex];
  const isPos = !!transaction?.order;
  const transactionType = isPos ? 'POS_PAYMENT' : 'PAYMENT';
  const methodLabel = transaction?.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'POS';
  const reference = transaction?.reference || transaction?.providerRef || transaction?.providerTransactionId || 'N/A';
  
  const cashierName = isPos 
    ? (transaction?.session?.operator?.firstName ? `${transaction.session.operator.firstName} ${transaction.session.operator.lastName}` : 'System')
    : (transaction?.frontdeskSession?.staff?.firstName ? `${transaction.frontdeskSession.staff.firstName} ${transaction.frontdeskSession.staff.lastName}` : 'System');

  const shiftRef = isPos ? transaction?.session?.shiftReference : transaction?.frontdeskSession?.shiftReference;
  const folioOrOrder = isPos ? `Order: ${transaction?.order?.receiptNumber || transaction?.order?.id?.slice(-6)}` : `Folio: ${transaction?.folio?.folioNumber}`;
  const location = isPos ? transaction?.order?.outlet?.name : 'Front Desk';
  const guestName = !isPos && transaction?.folio?.reservation?.primaryGuest
    ? `${transaction.folio.reservation.primaryGuest.firstName} ${transaction.folio.reservation.primaryGuest.lastName}` 
    : 'N/A';

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleVerify = async (status: 'VERIFIED' | 'QUESTIONED') => {
    if (status === 'QUESTIONED' && !notes.trim()) {
      alert('Please provide a reason for questioning this transaction.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/night-audit/resolve/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          transactionId: transaction.id,
          type: transactionType,
          status,
          notes: status === 'QUESTIONED' ? notes : undefined,
          idempotencyKey: `verify-${transaction.id}-${Date.now()}`
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify transaction');
      }

      setResolvedIds((current) => new Set(current).add(transaction.id));
      setSuccessType(status);
      setMode('SUCCESS');
      
      router.refresh();

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden border-white/[0.08] shadow-[0_40px_120px_rgba(0,0,0,0.8)]" style={{ background: '#07090f', color: 'white' }}>
        {unverifiedTransactions.length === 0 && mode !== 'SUCCESS' ? (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>All Transactions Verified</DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center text-slate-400">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p>No more pending transactions to verify.</p>
            </div>
            <div className="p-6 pt-0 flex justify-center">
              <button onClick={handleClose} className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-white/[0.1]">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative px-6 py-6 border-b border-white/[0.08]" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(124,58,237,0.05) 100%)' }}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="flex items-center gap-2 text-white">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                      Transaction Verification
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-slate-400">
                      Review each receipt before closing the business date.
                    </DialogDescription>
                  </div>
                  {unverifiedTransactions.length > 0 && (
                    <span className="shrink-0 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                      {unverifiedTransactions.length} remaining
                    </span>
                  )}
                </div>
              </DialogHeader>
            </div>

            {mode === 'VIEW' ? (
              <div className="space-y-5 p-6">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Receipt {currentIndex + 1} of {currentIndex + unverifiedTransactions.length}</span>
                  <span className="inline-flex items-center gap-1 text-rose-400"><Receipt className="h-3.5 w-3.5" /> Action required</span>
                </div>
                <div className="bg-white/[0.02] p-5 rounded-xl border border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-y-4 text-sm">
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Amount</div>
                    <div className="font-bold text-lg text-right text-white tabular-nums">{formatCurrency(Number(transaction.amount), transaction.currency)}</div>
                    
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Method</div>
                    <div className="text-right font-medium text-slate-200">{methodLabel}</div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Reference</div>
                    <div className="text-right font-mono text-xs text-slate-300 mt-0.5">{reference}</div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Date / Time</div>
                    <div className="text-right text-slate-300 tabular-nums">{new Date(transaction.createdAt).toLocaleString()}</div>

                    <div className="col-span-2 border-t border-white/[0.06] my-2"></div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Cashier</div>
                    <div className="text-right text-slate-200">{cashierName}</div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Location</div>
                    <div className="text-right text-slate-200">{location}</div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Shift Ref</div>
                    <div className="text-right text-xs text-slate-400 mt-0.5">{shiftRef || 'N/A'}</div>

                    <div className="col-span-2 border-t border-white/[0.06] my-2"></div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Guest / Account</div>
                    <div className="text-right text-slate-200">{guestName}</div>

                    <div className="text-slate-500 text-[11px] uppercase tracking-wider">Record</div>
                    <div className="text-right text-slate-300">{folioOrOrder}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center gap-3 pt-2">
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300 transition-all hover:bg-amber-400/20"
                    onClick={() => setMode('QUESTION')}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Question
                  </button>
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-400/20 disabled:opacity-50"
                    onClick={() => handleVerify('VERIFIED')}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Verify
                  </button>
                </div>
              </div>
            ) : mode === 'SUCCESS' ? (
              <div className="space-y-6 py-10 px-6 text-center flex flex-col items-center justify-center">
                <div className={`p-4 rounded-full border ${successType === 'VERIFIED' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400' : 'border-amber-400/20 bg-amber-400/10 text-amber-400'}`}>
                  <CheckCircle className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {successType === 'VERIFIED' ? 'Transaction Verified' : 'Transaction Questioned'}
                  </h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    {successType === 'VERIFIED' 
                      ? 'This transaction has been successfully verified and reconciled.' 
                      : 'This transaction has been flagged for further review by the finance team.'}
                  </p>
                </div>
                <div className="w-full pt-6">
                  <button 
                    className="w-full rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-6 py-3 text-sm font-bold text-indigo-300 transition-all hover:bg-indigo-500/30" 
                    onClick={handleContinue}
                  >
                    {unverifiedTransactions.length > 0 ? `Continue to Next (${unverifiedTransactions.length} left)` : 'Complete Verification'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-300">
                  You are questioning this transaction. It will remain an outstanding financial exception for Finance/Management to follow up on.
                </div>
                
                <div className="space-y-3">
                  <Label className="text-slate-300">Reason / Observation (Required)</Label>
                  <Textarea
                    placeholder="e.g., Bank reference does not match receipt, amount differs, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none border-white/[0.08] bg-white/[0.02] text-white focus-visible:ring-amber-400/30"
                  />
                </div>
                
                <div className="flex justify-between items-center gap-3 pt-2">
                  <button
                    className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/[0.1]"
                    onClick={() => setMode('VIEW')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300 transition-all hover:bg-amber-400/20 disabled:opacity-50"
                    onClick={() => handleVerify('QUESTIONED')}
                    disabled={isSubmitting || !notes.trim()}
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Question
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, DollarSign, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionSuccessModal } from '@/components/pos/ActionSuccessModal';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type MyShiftBankModalProps = {
  isOpen: boolean;
  onClose: () => void;
  posSessionId: string;
  provider: any;
  operatorToken: string;
  currentOperatorId?: string;
  onReconciled?: () => void;
};

export function MyShiftBankModal({
  isOpen,
  onClose,
  posSessionId,
  provider,
  operatorToken,
  currentOperatorId,
  onReconciled
}: MyShiftBankModalProps) {
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [successDialog, setSuccessDialog] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && posSessionId) {
      loadSessionContext();
    }
  }, [isOpen, posSessionId]);

  const loadSessionContext = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await provider.pos.getSessionContext(posSessionId);
      if (!res.error && res.data) {
        setSessionDetails(res.data);
      } else {
        setSessionDetails(null);
        setLoadError(res.error || 'No active shift bank was found. Open a POS shift and try again.');
      }
    } catch (e: any) {
      setSessionDetails(null);
      setLoadError(e?.message || 'Failed to load shift bank details.');
    } finally {
      setIsLoading(false);
    }
  };

  const actualCash = parseFloat(actualCashStr) || 0;
  const expectedCash = Number(sessionDetails?.expectedCash || 0);
  const variance = actualCash - expectedCash;

  const requestCloseShift = () => {
    if (actualCashStr === '') {
      toast.error('Please enter the actual physical cash you are handing over.');
      return;
    }
    if (variance !== 0) {
      toast.error('A variance requires supervisor authorization. Use the End of Shift Settlement screen to submit it.');
      return;
    }
    setShowCloseConfirm(true);
  };

  const handleCloseShift = async () => {
    setShowCloseConfirm(false);

    setIsSubmitting(true);
    try {
      const res = await provider.pos.settleSession(sessionDetails.id || posSessionId, actualCash, sessionDetails.primaryOperatorId || '', undefined, operatorToken);
      if (!res.error) {
        setSuccessDialog(true);
      } else {
        toast.error(res.error || 'Failed to reconcile shift.');
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Shift Bank</h2>
              <p className="text-indigo-100 text-sm">Review and submit the shift for management review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Loading details...</div>
          ) : loadError ? (
            <div className="py-12 text-center">
              <p className="font-semibold text-red-600">Unable to load shift bank</p>
              <p className="mt-2 text-sm text-slate-500">{loadError}</p>
              <Button className="mt-5" onClick={loadSessionContext}>Try again</Button>
            </div>
          ) : !sessionDetails ? (
            <div className="py-12 text-center text-slate-500">No active shift bank found.</div>
          ) : (
            <div className="space-y-6">
              
              {/* Total Shift Sales Overview */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Shift Sales</h3>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cash Sales</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.cashSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Card Sales</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.cardSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Bank Transfer</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.bankTransferSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Room Charges</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.roomChargeSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Other Sales</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.otherSales || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-indigo-50 px-4 py-3 border-t border-indigo-100 flex justify-between items-center">
                  <span className="font-semibold text-indigo-900">Total Revenue</span>
                  <span className="font-bold text-xl text-indigo-900">₦{Number(sessionDetails.totalSales || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Cash Accountability Table */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Cash Accountability</h3>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Opening Float</span>
                    <span className="font-medium text-slate-800">₦{Number(sessionDetails.openingBalance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cash Sales</span>
                    <span className="font-medium text-green-600">+ ₦{Number(sessionDetails.cashSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cash Refunds</span>
                    <span className="font-medium text-red-600">- ₦{Number(sessionDetails.cashRefunds || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cash Drops / Payouts</span>
                    <span className="font-medium text-red-600">- ₦{Number(sessionDetails.cashPaidOut || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Expected Cash on Hand</span>
                  <span className="font-bold text-xl text-slate-900">₦{expectedCash.toFixed(2)}</span>
                </div>
              </div>

              {/* Handover Input */}
              <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-5 space-y-4">
                <h3 className="font-semibold text-slate-800">Declared Cash</h3>
                <p className="text-sm text-slate-500">Count the physical cash and enter the total below. The shift will be submitted for General Cashier/Finance review.</p>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-semibold text-lg">₦</span>
                  </div>
                  <Input
                    type="number"
                    value={actualCashStr}
                    onChange={(e) => setActualCashStr(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 h-14 text-2xl font-bold rounded-xl border-blue-200 focus-visible:ring-blue-500 bg-white"
                  />
                </div>

                {actualCashStr !== '' && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl border ${variance === 0 ? 'bg-green-50 border-green-200 text-green-700' : variance < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <ArrowRightLeft className="w-5 h-5 shrink-0" />
                    <div className="text-sm font-medium">
                      {variance === 0 
                        ? 'Perfect Match (₦0.00 Variance)' 
                        : `Variance: ${variance > 0 ? '+' : ''}₦${variance.toFixed(2)} (${variance > 0 ? 'Over' : 'Short'})`
                      }
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 mt-4 shrink-0">
          <Button 
            onClick={requestCloseShift}
            disabled={isLoading || isSubmitting || !sessionDetails || (!!currentOperatorId && currentOperatorId !== sessionDetails.primaryOperatorId)}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? 'Submitting...' : 'Close and Submit Shift'}
          </Button>
          {!!currentOperatorId && currentOperatorId !== sessionDetails?.primaryOperatorId && (
            <p className="mt-2 text-center text-xs font-medium text-amber-700">Only the POS cashier who opened this shift can submit it.</p>
          )}
        </div>
      </div>

      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm shift submission</DialogTitle>
            <DialogDescription>Submitting will lock this POS shift and send it to General Cashier/Finance for review.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Expected cash</span><span className="font-semibold">₦{expectedCash.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Declared cash</span><span className="font-semibold">₦{actualCash.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Variance</span><span className="font-semibold text-emerald-700">₦0.00</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCloseConfirm(false)} disabled={isSubmitting}>Go back</Button><Button onClick={handleCloseShift} disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Confirm and submit'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {successDialog && (
        <ActionSuccessModal
          isOpen={successDialog}
          title="Shift Declared Successfully"
          message="Your shift bank has been submitted to the Cash Office for manager handover. You will now be securely logged out."
          onClose={() => {
            setSuccessDialog(false);
            if (onReconciled) onReconciled();
            onClose();
          }}
        />
      )}
    </div>
  );
}

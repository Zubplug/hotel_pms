'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, CheckCircle2, User, Key, ArrowRight, Wallet, Info } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { FrontDeskRefundDialog } from './FrontDeskRefundDialog';
import { ManagerOverrideModal } from '../pos/ManagerOverrideModal';

interface FrontDeskQuickCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialReservation?: any;
}

export function FrontDeskQuickCheckoutDialog({ open, onOpenChange, propertyId, initialReservation }: FrontDeskQuickCheckoutDialogProps) {
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();
  const [step, setStep] = useState<'IDLE' | 'LOADING' | 'READING' | 'CONFIRMING' | 'CHECKING_OUT' | 'ERASING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reservation, setReservation] = useState<any>(null);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [showManagerOverride, setShowManagerOverride] = useState(false);

  // Reset state when opened and hydrate list/detail reservations before confirmation.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadReservation = async () => {
      setErrorMsg('');
      setRefundPaymentId(null);
      if (!initialReservation) {
        setReservation(null);
        setStep('IDLE');
        return;
      }

      setReservation(initialReservation);
      const hasCheckoutDetails = Boolean(
        initialReservation.primaryGuest &&
        initialReservation.reservationRooms?.length &&
        (initialReservation.folios?.length || initialReservation.folio)
      );

      if (hasCheckoutDetails) {
        setStep('CONFIRMING');
        return;
      }

      setStep('LOADING');
      try {
        const result = await provider.reservations.get(initialReservation.id);
        const resolvedReservation = result?.data?.reservation || result?.data?.data || result?.data || result?.reservation || result;
        if (!resolvedReservation?.id) throw new Error('Unable to load reservation details');
        if (!cancelled) {
          setReservation(resolvedReservation);
          setStep('CONFIRMING');
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Unable to load reservation details');
          setStep('ERROR');
        }
      }
    };

    void loadReservation();
    return () => { cancelled = true; };
  }, [open, initialReservation, provider]);

  const handleReadCard = async () => {
    setStep('READING');
    setErrorMsg('');
    try {
      const data = await provider.keycards.read();
      if (!data || data.error) throw new Error(data?.error?.message || 'Failed to trigger read');

      const opId = data.data.operation.id;

      let readData = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pData = await provider.hardware.poll(opId);
        const op = pData.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') {
          readData = op.command?.responseData;
          break;
        } else if (op?.status === 'FAILED' || op?.status === 'ERROR') {
          throw new Error(op.errorMessage || 'Failed to read card');
        }
      }

      if (!readData) throw new Error('Timed out waiting for card read');
      if (!readData.roomNo) throw new Error('Card does not contain a room number');

      const lData = await provider.reservations.lookupByRoom(readData.roomNo, propertyId);
      if (!lData || lData.error) throw new Error(lData?.error?.message || 'Failed to lookup reservation');

      const resolvedReservation = lData.data?.reservation || lData.data?.data || lData.data || lData.reservation || lData;
      if (!resolvedReservation?.id && !resolvedReservation?.reservationId) {
        throw new Error(`No active reservation found for room ${readData.roomNo}`);
      }

      setReservation({
        ...resolvedReservation,
        id: resolvedReservation.id || resolvedReservation.reservationId,
        primaryGuest: resolvedReservation.primaryGuest || resolvedReservation.guest || null,
        reservationRooms: resolvedReservation.reservationRooms || resolvedReservation.rooms || [],
        folios: resolvedReservation.folios || (resolvedReservation.folio ? [resolvedReservation.folio] : []),
        balance: resolvedReservation.balance ?? resolvedReservation.folioBalance ?? 0,
      });
      setStep('CONFIRMING');

    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('ERROR');
    }
  };

  const handleCheckout = async (managerId?: string, managerPin?: string, reason?: string) => {
    if (!reservation) return;
    setStep('CHECKING_OUT');
    try {
      const data = await provider.reservations.checkOut(reservation.id, "System", "Device1", {
        managerId,
        managerPin,
        reason
      });
      if (!data || data.error) throw new Error(data?.error?.message || 'Checkout failed');

      setStep('ERASING');
      const cData = await provider.keycards.cancel();
      if (!cData || cData.error) throw new Error(cData?.error?.message || 'Failed to trigger cancel card');
      
      const opId = cData.data.operation.id;

      let erased = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pData = await provider.hardware.poll(opId);
        const op = pData.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') {
          erased = true;
          break;
        } else if (op?.status === 'FAILED' || op?.status === 'ERROR') {
          throw new Error('Checkout succeeded, but failed to erase physical card: ' + (op.errorMessage || 'Unknown hardware error'));
        }
      }

      if (!erased) throw new Error('Checkout succeeded, but timed out waiting to erase physical card.');

      setStep('SUCCESS');
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      triggerPrint();
    } catch (err: any) {
      const msg = err.message || 'Checkout failed';
      if (msg.includes('CREDIT_LIMIT_EXCEEDED')) {
        setStep('CONFIRMING');
        setShowManagerOverride(true);
        return;
      }
      setErrorMsg(msg);
      setStep('ERROR');
    }
  };

  const handleOverrideAuthorized = (managerId: string, managerPin: string, reason: string) => {
    setShowManagerOverride(false);
    handleCheckout(managerId, managerPin, reason);
  };

  const [printStatus, setPrintStatus] = useState<'IDLE' | 'PRINTING' | 'SUCCESS' | 'FAILED'>('IDLE');

  const triggerPrint = async () => {
    if (!HardwareBridge.isAvailable() || !reservation) return;
    setPrintStatus('PRINTING');
    try {
      const folio = reservation.folios?.[0] || reservation.folio || {};
      const room = reservation.reservationRooms?.[0]?.room || reservation.rooms?.[0]?.room || {};
      const guest = reservation.primaryGuest || reservation.guest || {};
      const transactions = (folio.transactions || []).map((transaction: any) => ({
        date: transaction.date || transaction.createdAt || new Date().toISOString(),
        description: transaction.description || transaction.type || 'Folio transaction',
        reference: transaction.reference || transaction.id || null,
        debitAmount: Number(transaction.debitAmount ?? transaction.debit ?? transaction.charge ?? 0),
        creditAmount: Number(transaction.creditAmount ?? transaction.credit ?? transaction.payment ?? 0),
        runningBalance: Number(transaction.runningBalance ?? 0),
      }));
      const res = await HardwareBridge.printGuestFolio({
        guestName: `${guest.firstName || 'Guest'} ${guest.lastName || ''}`.trim(),
        roomNumber: room.number || room.code || reservation.roomNumber || 'Unassigned',
        folioNumber: folio.id || reservation.id,
        arrivalDate: reservation.checkIn || reservation.reservationRooms?.[0]?.checkInDate || new Date().toISOString(),
        departureDate: reservation.checkOut || reservation.reservationRooms?.[0]?.checkOutDate || new Date().toISOString(),
        transactions,
        totalCharges: Number(folio.totalCharges || 0),
        totalPayments: Number(folio.totalPayments || 0),
        balanceDue: Number(folio.netBalance ?? folio.balance ?? 0),
        currency: folio.currency || reservation.currency || 'NGN',
        propertyName: reservation.property?.name || 'LodgeCore',
        propertyAddress: reservation.property?.address,
        printedAt: new Date().toISOString(),
      });
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      if (parsed?.success) {
        setPrintStatus('SUCCESS');
      } else {
        setPrintStatus('FAILED');
      }
    } catch (e) {
      setPrintStatus('FAILED');
    }
  };

  const balance = (reservation?.folios || []).reduce((total: number, folio: any) => (
    total + Number(folio?.netBalance ?? folio?.balance ?? 0)
  ), 0);
  const isUnpaid = balance > 0.01;
  const hasGuestCredit = balance < -0.01;
  const isFolioSettled = !isUnpaid && !hasGuestCredit;
  const creditRefundSource = (reservation?.folios || [])
    .map((folio: any) => ({
      folio,
      payment: (folio?.payments || []).find((candidate: any) => {
        if (candidate?.status !== 'COMPLETED') return false;
        const refunded = (candidate.refunds || [])
          .filter((refund: any) => refund?.status !== 'FAILED')
          .reduce((total: number, refund: any) => total + Number(refund?.amount || 0), 0);
        return Number(candidate.amount || 0) - refunded > 0.01;
      })
    }))
    .find((source: any) => source.payment);
  const creditRefundPayment = creditRefundSource?.payment;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Key className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Quick Checkout</h2>
              <p className="text-slate-400 text-sm font-medium">Read physical card to checkout guest</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 min-h-[300px] flex flex-col justify-center overflow-y-auto flex-1">
          
          {step === 'IDLE' && (
            <div className="text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CreditCard className="h-10 w-10 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Place Card on Encoder</h3>
              <p className="text-slate-500 mb-8 max-w-[280px] mx-auto">
                Place the physical room key on the hardware encoder, then click below to read it.
              </p>
              <Button onClick={handleReadCard} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg shadow-blue-200">
                Read Keycard <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {step === 'LOADING' && (
            <div className="text-center space-y-4 animate-in fade-in duration-300">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">Loading reservation...</h3>
              <p className="text-slate-500">Please wait while checkout details are prepared.</p>
            </div>
          )}

          {(step === 'READING' || step === 'CHECKING_OUT' || step === 'ERASING') && (
            <div className="text-center space-y-6 animate-in fade-in duration-300">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative w-full h-full bg-white rounded-full border-4 border-blue-500 flex items-center justify-center shadow-lg">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {step === 'READING' && 'Connecting to Encoder...'}
                  {step === 'CHECKING_OUT' && 'Processing Checkout...'}
                  {step === 'ERASING' && 'Erasing Keycard...'}
                </h3>
                <p className="text-slate-500 mt-2 font-medium">Please do not remove the card</p>
              </div>
            </div>
          )}

          {step === 'CONFIRMING' && reservation && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-xl font-bold text-slate-600">
                    {reservation.primaryGuest?.firstName?.[0] || reservation.guest?.firstName?.[0] || 'G'}{reservation.primaryGuest?.lastName?.[0] || reservation.guest?.lastName?.[0] || ''}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {reservation.primaryGuest?.firstName || reservation.guest?.firstName || 'Guest'} {reservation.primaryGuest?.lastName || reservation.guest?.lastName || ''}
                    </h3>
                    <p className="text-slate-500 font-medium">Room {reservation.reservationRooms[0]?.room?.number}</p>
                  </div>
                </div>

                {isUnpaid ? (
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-900 font-bold">Outstanding Balance</p>
                      <p className="text-red-700 text-sm mt-1 mb-2">Guest must pay {formatCurrency(balance)} before checkout can be processed.</p>
                      <Button size="sm" variant="destructive" className="w-full rounded-lg" onClick={() => onOpenChange(false)}>
                        Cancel & View Folio
                      </Button>
                    </div>
                  </div>
                ) : hasGuestCredit ? (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-900 font-bold">Guest Credit</p>
                      <p className="text-amber-700 text-sm mt-1 mb-2">Refund {formatCurrency(Math.abs(balance))} or resolve the credit before checkout.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg border-amber-300 text-amber-900 hover:bg-amber-100"
                        onClick={() => {
                          if (creditRefundPayment) {
                            setRefundPaymentId(creditRefundPayment.id);
                            onOpenChange(false);
                          } else {
                            onOpenChange(false);
                          }
                        }}
                      >
                        {creditRefundPayment ? 'Start Credit Refund' : 'View Folio for Refund'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-emerald-900 font-bold">Folio Settled</p>
                      <p className="text-emerald-700 text-sm">Guest is cleared for checkout.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 font-bold" onClick={() => setStep('IDLE')}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl font-bold shadow-sm"
                  onClick={handleCheckout} 
                  disabled={!isFolioSettled}
                  variant={!isFolioSettled ? "secondary" : "default"}
                >
                  Confirm Checkout
                </Button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Checkout Complete</h3>
              <p className="text-slate-500 mb-4 max-w-[280px] mx-auto">
                {reservation?.primaryGuest?.firstName || reservation?.guest?.firstName || 'Guest'} has been checked out and the keycard is erased.
              </p>

              <div className="mb-8 p-4 bg-slate-50 border border-slate-100 rounded-xl max-w-[320px] mx-auto flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-slate-600">
                  {printStatus === 'PRINTING' && 'Printing Guest Folio...'}
                  {printStatus === 'SUCCESS' && 'Guest Folio Printed'}
                  {printStatus === 'FAILED' && 'Printer Unavailable'}
                  {printStatus === 'IDLE' && 'Skipped Printing'}
                </p>
                {printStatus === 'FAILED' && (
                  <Button variant="outline" size="sm" onClick={triggerPrint} className="h-8 text-xs rounded-full">
                    Retry Print
                  </Button>
                )}
              </div>

              <Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-lg font-bold">
                Done
              </Button>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Checkout Failed</h3>
              <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-8 text-left border border-red-100 break-words">
                {errorMsg}
              </div>
              <Button onClick={() => setStep('IDLE')} variant="outline" className="w-full h-12 rounded-xl border-slate-200 font-bold mb-3">
                Try Again
              </Button>
              <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full text-slate-500">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
      {refundPaymentId && reservation?.folios?.[0] && (
      <FrontDeskRefundDialog
        open
        onOpenChange={(isOpen) => { if (!isOpen) setRefundPaymentId(null); }}
        paymentId={refundPaymentId}
        folio={creditRefundSource?.folio}
        reservation={reservation}
        initialCategory="FOLIO_CREDIT_BALANCE"
      />
      )}
      <ManagerOverrideModal
        isOpen={showManagerOverride}
        actionName="City Ledger Checkout Override"
        onAuthorized={handleOverrideAuthorized}
        onCancel={() => setShowManagerOverride(false)}
      />
    </>
  );
}

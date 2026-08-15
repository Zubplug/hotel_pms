'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, CheckCircle2, User, Key, ArrowRight, Wallet, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FrontDeskQuickCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function FrontDeskQuickCheckoutDialog({ open, onOpenChange, propertyId }: FrontDeskQuickCheckoutDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'IDLE' | 'READING' | 'CONFIRMING' | 'CHECKING_OUT' | 'ERASING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [reservation, setReservation] = useState<any>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep('IDLE');
      setErrorMsg('');
      setReservation(null);
    }
  }, [open]);

  const handleReadCard = async () => {
    setStep('READING');
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/hardware/locks/read-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to trigger read');

      const opId = data.data.operation.id;

      let readData = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await fetch(`/api/v1/hardware/operations/${opId}`);
        const pData = await pRes.json();
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

      const lRes = await fetch(`/api/v1/reservations/lookup?roomNo=${readData.roomNo}&propertyId=${propertyId}`);
      const lData = await lRes.json();
      if (!lRes.ok) throw new Error(lData.error?.message || 'Failed to lookup reservation');

      if (!lData.data.reservation) {
        throw new Error(`No active reservation found for room ${readData.roomNo}`);
      }

      setReservation(lData.data.reservation);
      setStep('CONFIRMING');

    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('ERROR');
    }
  };

  const handleCheckout = async () => {
    if (!reservation) return;
    setStep('CHECKING_OUT');
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Checkout failed');

      setStep('ERASING');
      const cRes = await fetch('/api/v1/hardware/locks/cancel-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error?.message || 'Failed to trigger cancel card');
      
      const opId = cData.data.operation.id;

      let erased = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await fetch(`/api/v1/hardware/operations/${opId}`);
        const pData = await pRes.json();
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
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('ERROR');
    }
  };

  const balance = reservation?.folios?.[0]?.balance || 0;
  const isUnpaid = balance > 0;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
        
        <div className="bg-slate-900 px-8 py-6 text-white">
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

        <div className="p-8 bg-slate-50 min-h-[300px] flex flex-col justify-center">
          
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
                    {reservation.primaryGuest.firstName[0]}{reservation.primaryGuest.lastName[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {reservation.primaryGuest.firstName} {reservation.primaryGuest.lastName}
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
                  disabled={isUnpaid}
                  variant={isUnpaid ? "secondary" : "default"}
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
              <p className="text-slate-500 mb-8 max-w-[280px] mx-auto">
                {reservation?.primaryGuest.firstName} has been checked out and the keycard is erased.
              </p>
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
  );
}

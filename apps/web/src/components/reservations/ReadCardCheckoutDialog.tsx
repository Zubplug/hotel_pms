'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReadCardCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function ReadCardCheckoutDialog({ open, onOpenChange, propertyId }: ReadCardCheckoutDialogProps) {
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
      // 1. Dispatch READ_CARD
      const res = await fetch('/api/v1/hardware/locks/read-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to trigger read');

      const opId = data.data.operation.id;

      // 2. Poll for completion
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

      // 3. Lookup reservation by roomNo
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
      // 1. Process Checkout
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Checkout failed');

      // 2. Dispatch CANCEL_CARD to physically erase the card
      setStep('ERASING');
      const cRes = await fetch('/api/v1/hardware/locks/cancel-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error?.message || 'Failed to trigger cancel card');
      
      const opId = cData.data.operation.id;

      // 3. Poll for Erase completion
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
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('ERROR');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Quick Checkout</DialogTitle>
          <DialogDescription>
            Place the guest's key card on the encoder to check them out.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[150px]">
          {step === 'IDLE' && (
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
              <Button onClick={handleReadCard}>Read Card</Button>
            </div>
          )}

          {(step === 'READING' || step === 'CHECKING_OUT' || step === 'ERASING') && (
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
              <p className="text-sm font-medium">
                {step === 'READING' && 'Waiting for card... (place on encoder)'}
                {step === 'CHECKING_OUT' && 'Processing checkout & validating folio...'}
                {step === 'ERASING' && 'Erasing physical card...'}
              </p>
            </div>
          )}

          {step === 'CONFIRMING' && reservation && (
            <div className="w-full space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg border">
                <h3 className="font-semibold text-lg">{reservation.primaryGuest.firstName} {reservation.primaryGuest.lastName}</h3>
                <p className="text-sm text-muted-foreground">Room {reservation.room?.number}</p>
                <div className="mt-3 pt-3 border-t flex justify-between">
                  <span className="text-sm font-medium">Folio Balance:</span>
                  <span className={`text-sm font-bold ${reservation.balance !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₦{reservation.balance.toLocaleString()}
                  </span>
                </div>
              </div>

              {reservation.balance !== 0 && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md flex gap-2 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>Guest has an outstanding balance. Please settle the folio before checking out.</p>
                </div>
              )}
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="text-lg font-semibold">Checkout Complete</p>
              <p className="text-sm text-muted-foreground">The reservation was checked out and the key card was erased successfully.</p>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-sm font-medium text-red-600 max-w-[300px] leading-relaxed">{errorMsg}</p>
              <Button variant="outline" onClick={() => setStep('IDLE')}>Try Again</Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'CONFIRMING' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCheckout} disabled={reservation?.balance !== 0}>
                Confirm Checkout
              </Button>
            </>
          )}
          {step === 'SUCCESS' && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, Info, BedDouble, CalendarDays, User } from 'lucide-react';
import { format } from 'date-fns';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface ReadCardInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function ReadCardInfoDialog({ open, onOpenChange, propertyId }: ReadCardInfoDialogProps) {
  const [step, setStep] = useState<'IDLE' | 'READING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [cardInfo, setCardInfo] = useState<any>(null);
  const [reservation, setReservation] = useState<any>(null);

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      setStep('IDLE');
      setErrorMsg('');
      setCardInfo(null);
      setReservation(null);
    }
  }, [open]);

  const { provider } = useLodgeCoreProvider();

  const handleReadCard = async () => {
    setStep('READING');
    setErrorMsg('');
    try {
      // 1. Dispatch READ_CARD
      const data = await provider.keycards.read();
      if (!data.success) throw new Error(data.error?.message || 'Failed to initiate read card');
      const opId = data.data.operation.id;

      // 2. Poll for completion
      let readData = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await provider.hardware.poll(opId);
        if (!pRes.success) throw new Error(pRes.error?.message || 'Failed to poll hardware status');
        
        const op = pRes.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') {
          readData = op.command?.responseData;
          break;
        } else if (op?.status === 'FAILED' || op?.status === 'ERROR') {
          throw new Error(op.errorMessage || 'Failed to read card');
        }
      }

      if (!readData) throw new Error('Timed out waiting for card read');
      setCardInfo(readData);

      // 3. Lookup reservation by roomNo if present
      if (readData.roomNo) {
        try {
          const lRes = await provider.reservations.lookupByRoom(readData.roomNo, propertyId);
          if (lRes) {
            setReservation(lRes);
          }
        } catch (e) {
          console.error('Failed to lookup reservation', e);
        }
      }

      setStep('SUCCESS');
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('ERROR');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Read Card Info</DialogTitle>
          <DialogDescription>
            Place any key card on the encoder to view its contents and associated booking.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[150px]">
          {step === 'IDLE' && (
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
              <Button onClick={handleReadCard}>Read Card Details</Button>
            </div>
          )}

          {step === 'READING' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
              <p className="text-sm font-medium">
                Waiting for card... (place on encoder)
              </p>
            </div>
          )}

          {step === 'SUCCESS' && cardInfo && (
            <div className="w-full space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Card Data</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Room:</div>
                  <div className="font-medium text-right">{cardInfo.roomNo || 'None'}</div>
                  
                  <div className="text-muted-foreground">Valid From:</div>
                  <div className="font-medium text-right">{cardInfo.checkIn ? format(new Date(cardInfo.checkIn), 'PPp') : 'N/A'}</div>
                  
                  <div className="text-muted-foreground">Valid To:</div>
                  <div className="font-medium text-right">{cardInfo.checkOut ? format(new Date(cardInfo.checkOut), 'PPp') : 'N/A'}</div>
                </div>
              </div>

              {reservation ? (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                    <User className="w-4 h-4" />
                    <span>Active Reservation</span>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest:</span>
                      <span className="font-medium">{reservation.primaryGuest.firstName} {reservation.primaryGuest.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check In:</span>
                      <span className="font-medium">{format(new Date(reservation.checkIn), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check Out:</span>
                      <span className="font-medium">{format(new Date(reservation.checkOut), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
              ) : cardInfo.roomNo ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-md flex gap-2 text-sm text-yellow-800 dark:text-yellow-500">
                  <Info className="h-5 w-5 shrink-0" />
                  <p>No active checked-in reservation was found for this room number.</p>
                </div>
              ) : null}
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
          {(step === 'SUCCESS' || step === 'ERROR') && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

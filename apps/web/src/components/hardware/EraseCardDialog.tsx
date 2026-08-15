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
import { CreditCard, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface EraseCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function EraseCardDialog({ open, onOpenChange, propertyId }: EraseCardDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'IDLE' | 'ERASING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      setStep('IDLE');
      setErrorMsg('');
    }
  }, [open]);

  const handleEraseCard = async () => {
    setStep('ERASING');
    setErrorMsg('');
    try {
      // 1. Dispatch CANCEL_CARD
      const cRes = await fetch('/api/v1/hardware/locks/cancel-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error?.message || 'Failed to trigger cancel card');
      
      const opId = cData.data.operation.id;

      // 2. Poll for Erase completion
      let erased = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await fetch(`/api/v1/hardware/operations/${opId}`);
        const pData = await pRes.json();
        const op = pData.data?.operation;
        if (op?.status === 'SUCCESS') {
          erased = true;
          break;
        } else if (op?.status === 'FAILED' || op?.status === 'ERROR') {
          throw new Error('Failed to erase physical card: ' + (op.errorMessage || 'Unknown hardware error'));
        }
      }

      if (!erased) throw new Error('Timed out waiting to erase physical card.');

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
          <DialogTitle>Wipe / Erase Key Card</DialogTitle>
          <DialogDescription>
            Place the key card on the encoder to permanently erase its data. This will revoke access to any doors immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[150px]">
          {step === 'IDLE' && (
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
              <Button onClick={handleEraseCard} variant="destructive">
                Start Erase Process
              </Button>
            </div>
          )}

          {step === 'ERASING' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
              <p className="text-sm font-medium">
                Waiting for card... (place on encoder)
              </p>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="text-lg font-semibold">Card Erased</p>
              <p className="text-sm text-muted-foreground">The physical key card has been wiped successfully.</p>
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
          {step === 'SUCCESS' && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

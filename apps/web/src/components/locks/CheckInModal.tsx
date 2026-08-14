'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, CreditCard, KeyRound } from 'lucide-react';

interface CheckInModalProps {
  reservationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CheckInModal({ reservationId, isOpen, onClose, onSuccess }: CheckInModalProps) {
  const [status, setStatus] = useState<'IDLE' | 'INITIATING' | 'QUEUED' | 'DISPATCHING' | 'WAITING_FOR_CARD' | 'ENCODING' | 'VERIFYING' | 'ACTIVE' | 'FAILED'>('IDLE');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('IDLE');
      setOperationId(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const initiateCheckIn = async () => {
    setStatus('INITIATING');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservationId}/check-in`, { method: 'POST' });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to initiate check-in');
      }

      setOperationId(json.data.operationId);
      setStatus(json.data.operationStatus || 'QUEUED');
    } catch (err: any) {
      setStatus('FAILED');
      setErrorMsg(err.message);
    }
  };

  // Poll for hardware status
  useEffect(() => {
    if (!isOpen || !operationId || status === 'ACTIVE' || status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/hardware/operations/${operationId}`);
        if (res.ok) {
          const json = await res.json();
          setStatus(json.data.status);
          if (json.data.status === 'FAILED') {
             setErrorMsg(json.data.errorMessage);
          } else if (json.data.status === 'ACTIVE') {
             if (onSuccess) onSuccess();
          }
        }
      } catch (err) {
        console.error('Failed to poll operation status');
      }
    }, 1500); // Check every 1.5s

    return () => clearInterval(interval);
  }, [isOpen, operationId, status, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Check In Guest</DialogTitle>
          <DialogDescription>
            Initiate the automatic check-in sequence and prepare the room key.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[200px] text-center space-y-4">
          {status === 'IDLE' && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Click below to validate the reservation and automatically issue a room key to the front desk encoder.
              </p>
              <Button onClick={initiateCheckIn} size="lg" className="w-full mt-4">
                Start Check-in Sequence
              </Button>
            </>
          )}

          {['INITIATING', 'QUEUED', 'DISPATCHING'].includes(status) && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-2" />
              <h3 className="text-lg font-medium">Preparing Room Key</h3>
              <p className="text-sm text-muted-foreground">Connecting to front desk hardware...</p>
            </>
          )}

          {status === 'WAITING_FOR_CARD' && (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-2 animate-pulse">
                <CreditCard className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-blue-600">Place Card on Encoder</h3>
              <p className="text-sm text-muted-foreground">Waiting for blank RFID card...</p>
            </>
          )}

          {['ENCODING', 'VERIFYING'].includes(status) && (
            <>
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-2" />
              <h3 className="text-lg font-medium text-amber-600">
                {status === 'ENCODING' ? 'Writing Card...' : 'Verifying Data...'}
              </h3>
              <p className="text-sm text-muted-foreground">Please do not remove the card.</p>
            </>
          )}

          {status === 'ACTIVE' && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium text-emerald-600">Check-in Complete</h3>
              <p className="text-sm text-muted-foreground">The room key is ready for the guest.</p>
            </>
          )}

          {status === 'FAILED' && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-destructive">Hardware Error</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">{errorMsg}</p>
              <Button onClick={() => setStatus('IDLE')} variant="outline" className="mt-4">
                Try Again
              </Button>
            </>
          )}
        </div>

        {['ACTIVE', 'FAILED'].includes(status) && (
          <DialogFooter>
            <Button onClick={onClose} variant={status === 'ACTIVE' ? 'default' : 'secondary'} className="w-full">
              {status === 'ACTIVE' ? 'Done' : 'Close'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

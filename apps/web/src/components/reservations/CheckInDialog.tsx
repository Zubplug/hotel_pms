'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, KeySquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function CheckInDialog({ open, onOpenChange, reservation }: CheckInDialogProps) {
  const router = useRouter();
  
  const [phase, setPhase] = useState<'CONFIRM' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('CONFIRM');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('CONFIRM');
      setOperationId(null);
      setErrorMsg(null);
      setHardwareStatus('');
    }
  }, [open]);

  // Polling Effect
  useEffect(() => {
    if (phase !== 'ENCODING' || !operationId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/hardware/operations/${operationId}`);
        if (!res.ok) throw new Error('Failed to poll operation status');
        
        const data = await res.json();
        const status = data.data.operation.status;
        
        setHardwareStatus(status);

        if (status === 'SUCCESS') {
          setPhase('SUCCESS');
          router.refresh(); // Refresh background data to show CHECKED_IN
        } else if (status === 'FAILED') {
          setPhase('FAILED');
          setErrorMsg(data.data.operation.errorMessage || 'Hardware agent failed to encode the card.');
        }
      } catch (err) {
        console.error(err);
        // Do not fail immediately on network blip
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, operationId, router]);

  const handleStartCheckIn = async () => {
    try {
      setPhase('ENCODING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);

      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-in`, {
        method: 'POST',
      });
      
      const data = await res.json();

      if (!res.ok) {
        setPhase('FAILED');
        setErrorMsg(data.error?.message || 'Failed to initiate check-in');
        return;
      }

      setOperationId(data.data.operationId);
      setHardwareStatus(data.data.status);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const getStatusText = () => {
    switch (hardwareStatus) {
      case 'QUEUED':
        return 'Command sent to queue...';
      case 'DISPATCHING':
        return 'Waiting for Windows Agent to pick up...';
      case 'WAITING_FOR_CARD':
        return 'Please place a blank card on the USB Encoder now.';
      case 'CARD_DETECTED':
        return 'Card detected. Reading...';
      case 'ENCODING':
        return 'Writing security payload to card...';
      default:
        return hardwareStatus || 'Initializing...';
    }
  };

  const resRoom = reservation.reservationRooms?.[0];
  const roomName = resRoom?.room?.number || 'Unassigned';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing by clicking outside while encoding
      if (phase === 'ENCODING' && !val) return;
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== 'ENCODING'}>
        <DialogHeader>
          <DialogTitle>Guest Check-In</DialogTitle>
          <DialogDescription>
            Encode a physical access card for Room {roomName}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[160px] text-center">
          {phase === 'CONFIRM' && (
            <div className="space-y-4 w-full">
              <div className="bg-muted p-4 rounded-lg flex items-center justify-between border">
                <div className="flex items-center gap-3">
                  <KeySquare className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">Room {roomName}</p>
                    <p className="text-xs text-muted-foreground">Guest: {reservation.primaryGuest?.firstName} {reservation.primaryGuest?.lastName}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Ensure the USB Encoder is plugged into the front-desk PC.
              </p>
            </div>
          )}

          {phase === 'ENCODING' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <div className="bg-primary/10 p-4 rounded-full relative">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-lg">Encoding in Progress</p>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  {getStatusText()}
                </p>
              </div>
            </div>
          )}

          {phase === 'SUCCESS' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-500/10 p-4 rounded-full">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-xl text-green-600 dark:text-green-500">Check-in Complete!</p>
                <p className="text-sm text-muted-foreground">
                  Card encoded successfully. The guest is now checked in and the room is Occupied.
                </p>
              </div>
            </div>
          )}

          {phase === 'FAILED' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-destructive/10 p-4 rounded-full">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-xl text-destructive">Hardware Error</p>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          {phase === 'CONFIRM' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handleStartCheckIn}>Start Encoding</Button>
            </>
          )}
          {phase === 'FAILED' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handleStartCheckIn}>Try Again</Button>
            </>
          )}
          {phase === 'SUCCESS' && (
            <DialogClose render={<Button variant="default">Done</Button>} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

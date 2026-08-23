'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, KeySquare } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface ExtendKeyCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function ExtendKeyCardDialog({ open, onOpenChange, reservation }: ExtendKeyCardDialogProps) {
  const router = useRouter();
  
  const [phase, setPhase] = useState<'CONFIRM' | 'READING' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('CONFIRM');
  const [readOperationId, setReadOperationId] = useState<string | null>(null);
  const [encodeOperationId, setEncodeOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase('CONFIRM');
      setReadOperationId(null);
      setEncodeOperationId(null);
      setErrorMsg(null);
      setHardwareStatus('');
    }
  }, [open]);

  const { provider } = useLodgeCoreProvider();

  // Polling Effect for Reading
  useEffect(() => {
    if (phase !== 'READING' || !readOperationId || !provider) return;

    const interval = setInterval(async () => {
      try {
        const res = await provider.hardware.poll(readOperationId);
        if (!res.success) throw new Error(res.error?.message || 'Failed to poll operation status');
        
        const op = res.data?.operation;
        const status = op?.status;
        
        setHardwareStatus(status || '');

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          // Card read successfully. Proceed to Encode.
          executeEncodeCard(readOperationId);
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED');
          setErrorMsg(op.errorMessage || 'Hardware agent failed to read the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, readOperationId, provider]);

  // Polling Effect for Encoding
  useEffect(() => {
    if (phase !== 'ENCODING' || !encodeOperationId || !provider) return;

    const interval = setInterval(async () => {
      try {
        const res = await provider.hardware.poll(encodeOperationId);
        if (!res.success) throw new Error(res.error?.message || 'Failed to poll operation status');
        
        const op = res.data?.operation;
        const status = op?.status;
        
        setHardwareStatus(status || '');

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          setPhase('SUCCESS');
          router.refresh();
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED');
          setErrorMsg(op.errorMessage || 'Hardware agent failed to encode the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, encodeOperationId, router, provider]);

  const handleStartExtension = async () => {
    try {
      setPhase('READING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);

      const res = await provider.keycards.read();

      if (!res.success) {
        setPhase('FAILED');
        setErrorMsg(res.error?.message || 'Failed to initiate read card');
        return;
      }

      setReadOperationId(res.data.operation.id);
      setHardwareStatus(res.data.operation.status);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const executeEncodeCard = async (readOpId: string) => {
    try {
      setPhase('ENCODING');
      setHardwareStatus('VERIFYING_CARD');
      setErrorMsg(null);

      // We just call encode with the reservation details directly on Desktop!
      // The Cloud API used extend-card which read the check-out date from the DB.
      // We can just call provider.keycards.encode which looks up the reservation internally.
      const res = await provider.keycards.encode(reservation.reservationRooms?.[0]?.roomId, '', reservation.id);

      if (!res.success) {
        setPhase('FAILED');
        setErrorMsg(res.error?.message || 'Failed to initiate encode. Card mismatch?');
        return;
      }

      // Encode returns operation payload matching the cloud endpoint format
      setEncodeOperationId(res.data.operationId || res.data.operation?.id);
      setHardwareStatus(res.data.status || res.data.operation?.status);
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
        return 'Please place the guest\'s current card on the USB Encoder now.';
      case 'CARD_DETECTED':
        return 'Card detected. Processing...';
      case 'VERIFYING_CARD':
        return 'Verifying card belongs to correct room...';
      case 'ENCODING':
        return 'Writing new expiration date to card...';
      default:
        return hardwareStatus || 'Initializing...';
    }
  };

  const resRoom = reservation.reservationRooms?.[0];
  const roomName = resRoom?.room?.number || 'Unassigned';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing by clicking outside while encoding or reading
      if ((phase === 'ENCODING' || phase === 'READING') && !val) return;
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== 'ENCODING' && phase !== 'READING'}>
        <DialogHeader>
          <DialogTitle>Extend Key Card</DialogTitle>
          <DialogDescription>
            Update the physical access card for Room {roomName} with the new check-out date.
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
                Ensure the USB Encoder is plugged in. The system will read the card to verify it belongs to Room {roomName} before updating it.
              </p>
            </div>
          )}

          {(phase === 'READING' || phase === 'ENCODING') && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <div className="bg-primary/10 p-4 rounded-full relative">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-lg">{phase === 'READING' ? 'Reading Card...' : 'Updating Card...'}</p>
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
                <p className="font-semibold text-xl text-green-600 dark:text-green-500">Card Updated!</p>
                <p className="text-sm text-muted-foreground">
                  The physical card is now valid until the new check-out date.
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
              <Button onClick={handleStartExtension}>Read & Update Card</Button>
            </>
          )}
          {phase === 'FAILED' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handleStartExtension}>Try Again</Button>
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

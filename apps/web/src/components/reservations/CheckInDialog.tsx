'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, KeyRound, Save, KeySquare } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function CheckInDialog({ open, onOpenChange, reservation }: CheckInDialogProps) {
  const router = useRouter();
  
  const [phase, setPhase] = useState<'CONFIRM' | 'READING' | 'OVERWRITE_CONFIRM' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('CONFIRM');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [existingCardData, setExistingCardData] = useState<any>(null);

  const { provider } = useLodgeCoreProvider();

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase('CONFIRM');
      setOperationId(null);
      setErrorMsg(null);
      setHardwareStatus('');
      setExistingCardData(null);
    }
  }, [open]);

  // Polling Effect for Reading
  useEffect(() => {
    if (phase !== 'READING' || !operationId || !provider) return;

    const interval = setInterval(async () => {
      try {
        const res = await provider.hardware.poll(operationId);
        if (!res.success) throw new Error(res.error?.message || 'Failed to poll operation status');
        
        const op = res.data?.operation;
        const status = op?.status;
        
        setHardwareStatus(status || '');

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          const cardData = op.command?.responseData;
          
          if (cardData && cardData.checkOut && new Date(cardData.checkOut) > new Date()) {
            // Card is currently active
            setExistingCardData(cardData);
            setPhase('OVERWRITE_CONFIRM');
          } else {
            // Blank or expired card, proceed to encode
            executeCheckInEncoding();
          }
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED');
          setErrorMsg(op.errorMessage || 'Hardware agent failed to read the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, operationId, provider]);

  // Polling Effect for Encoding
  useEffect(() => {
    if (phase !== 'ENCODING' || !operationId || !provider) return;

    const interval = setInterval(async () => {
      try {
        const res = await provider.hardware.poll(operationId);
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
  }, [phase, operationId, router]);

  const handleStartCheckIn = async () => {
    try {
      setPhase('READING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);

      const res = await provider.keycards.read();
      if (!res.success) throw new Error(res.error?.message || 'Failed to initiate read card');

      setOperationId(res.data.operation.id);
      setHardwareStatus(res.data.operation.status);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const executeCheckInEncoding = async () => {
    try {
      setPhase('ENCODING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);
      setOperationId(null); // Reset operation ID for the new encoding task

      // Cloud logic checks in and triggers encode; Desktop checkIn does the same locally
      const res = await provider.reservations.checkIn(reservation.id, '', '');
      if (!res.success) throw new Error(res.error?.message || 'Failed to initiate check-in');

      setOperationId(res.data.operationId);
      setHardwareStatus(res.data.status);
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
        return 'Card detected. Processing...';
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
      // Prevent closing by clicking outside while encoding or reading
      if ((phase === 'ENCODING' || phase === 'READING') && !val) return;
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== 'ENCODING' && phase !== 'READING'}>
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
                Ensure the USB Encoder is plugged into the front-desk PC. The system will read the card first to ensure it is blank.
              </p>
            </div>
          )}

          {phase === 'READING' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <div className="bg-primary/10 p-4 rounded-full relative">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-lg">Reading Card Status</p>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  {getStatusText()}
                </p>
              </div>
            </div>
          )}

          {phase === 'OVERWRITE_CONFIRM' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-amber-500/10 p-4 rounded-full">
                <AlertCircle className="w-10 h-10 text-amber-500" />
              </div>
              <div className="space-y-2 w-full">
                <p className="font-semibold text-lg text-amber-600 dark:text-amber-500">Active Card Detected</p>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded text-sm text-left border border-amber-200 dark:border-amber-800">
                  <p className="font-medium text-amber-900 dark:text-amber-400">This card is currently active!</p>
                  <ul className="mt-1 text-amber-800 dark:text-amber-500 space-y-1">
                    <li>Room: <span className="font-semibold">{existingCardData?.roomNo || 'Unknown'}</span></li>
                    <li>Valid Until: <span className="font-semibold">{existingCardData?.checkOut ? new Date(existingCardData.checkOut).toLocaleString() : 'Unknown'}</span></li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to overwrite this card with the new check-in data? The previous guest will be locked out.
                </p>
              </div>
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
          {phase === 'OVERWRITE_CONFIRM' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button variant="destructive" onClick={executeCheckInEncoding}>Overwrite & Encode</Button>
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { format, addDays, startOfDay } from 'date-fns';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface ExtendStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function ExtendStayDialog({ open, onOpenChange, reservation }: ExtendStayDialogProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<'SELECT' | 'PREVIEW' | 'PROCESSING' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('SELECT');
  const [newCheckoutDate, setNewCheckoutDate] = useState<Date | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extensionApplied, setExtensionApplied] = useState(false);
  const { provider } = useLodgeCoreProvider();

  const currentCheckOut = new Date(reservation.checkOut);
  const minDate = startOfDay(currentCheckOut);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setPhase('SELECT');
      setNewCheckoutDate(undefined);
      setPreviewData(null);
      setErrorMsg(null);
      setExtensionApplied(false);
    }
  }, [open]);

  const handlePreview = async () => {
    if (!newCheckoutDate) return;
    setPhase('PROCESSING');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/extend/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCheckoutDate: newCheckoutDate.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) { setPhase('FAILED'); setErrorMsg(data.error?.message || 'Preview failed'); return; }
      setPreviewData(data.data);
      setPhase('PREVIEW');
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    }
  };

  const handleEncodeCard = async () => {
    setPhase('ENCODING');
    setErrorMsg(null);
    try {
      const roomId = reservation.reservationRooms?.[0]?.room?.id
        || reservation.reservationRooms?.[0]?.roomId
        || reservation.roomId;
      if (!roomId) throw new Error('Stay extended, but no assigned room was found for keycard encoding.');
      const encodeResult = await provider.keycards.encode(roomId, '', reservation.id);
      if (!encodeResult?.success || encodeResult?.error) {
        throw new Error(encodeResult?.error?.message || encodeResult?.error || 'Keycard encoding failed.');
      }
      setPhase('SUCCESS');
      router.refresh();
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Keycard encoding failed');
    }
  };

  const handleConfirmExtend = async () => {
    if (!newCheckoutDate) return;
    setPhase('PROCESSING');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCheckoutDate: newCheckoutDate.toISOString(),
          idempotencyKey: `EXTEND:${reservation.id}:${newCheckoutDate.toISOString()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setPhase('FAILED'); setErrorMsg(data.error?.message || 'Extension failed'); return; }
      setExtensionApplied(true);
      await handleEncodeCard();
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    }
  };

  const formatMoney = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN' }).format(amount);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if ((phase === 'PROCESSING' || phase === 'ENCODING') && !val) return;
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend Stay</DialogTitle>
          <DialogDescription>
            Select a new check-out date. The guest will be charged for the additional nights at the current room rate.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[140px]">
          {phase === 'SELECT' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Current Check-Out</p>
                <p className="font-semibold">{format(currentCheckOut, 'PPP')}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">New Check-Out Date</p>
                <DatePicker
                  value={newCheckoutDate}
                  onChange={setNewCheckoutDate}
                  placeholder="Select new check-out date"
                  disabledDays={(date) => date <= minDate}
                />
                <p className="text-xs text-muted-foreground mt-1">Must be after current check-out</p>
              </div>
            </div>
          )}

          {phase === 'PREVIEW' && previewData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Additional Nights</span>
                  <span className="font-medium">{previewData.additionalNights}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate per Night</span>
                  <span className="font-medium">{formatMoney(Number(previewData.ratePerNight), previewData.currency)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Additional Charge</span>
                  <span className="font-semibold text-primary">{formatMoney(previewData.additionalCharge, previewData.currency)}</span>
                </div>
              </div>
              <div className="flex gap-2 p-3 rounded text-sm border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-500">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This amount will be posted to the guest&apos;s folio immediately. You can extend the physical key card separately.</span>
              </div>
            </div>
          )}

          {(phase === 'PROCESSING' || phase === 'ENCODING') && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {phase === 'ENCODING' ? 'Place the guest card on the encoder to update it...' : 'Processing...'}
              </p>
            </div>
          )}

          {phase === 'SUCCESS' && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <div className="bg-green-500/10 p-4 rounded-full">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <p className="font-semibold text-lg text-green-600 dark:text-green-500">Stay Extended!</p>
              <p className="text-sm text-center text-muted-foreground">
                Reservation updated and folio charged. Don&apos;t forget to extend the physical key card if needed.
              </p>
            </div>
          )}

          {phase === 'FAILED' && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <div className="bg-destructive/10 p-4 rounded-full">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <p className="font-semibold text-lg text-destructive">Extension Failed</p>
              <p className="text-sm text-center text-muted-foreground">{errorMsg}</p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          {phase === 'SELECT' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handlePreview} disabled={!newCheckoutDate || newCheckoutDate <= minDate}>
                Calculate Charges
              </Button>
            </>
          )}
          {phase === 'PREVIEW' && (
            <>
              <Button variant="outline" onClick={() => setPhase('SELECT')}>Back</Button>
              <Button onClick={handleConfirmExtend}>Confirm Extension</Button>
            </>
          )}
          {phase === 'FAILED' && (
            <>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={extensionApplied ? handleEncodeCard : handlePreview}>Try Again</Button>
            </>
          )}
          {phase === 'SUCCESS' && (
            <DialogClose render={<Button>Done</Button>} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Loader2, CheckCircle2, AlertCircle, CalendarClock, ArrowRight, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';

interface FrontDeskExtendStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function FrontDeskExtendStayDialog({ open, onOpenChange, reservation }: FrontDeskExtendStayDialogProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<'SELECT' | 'PREVIEW' | 'PROCESSING' | 'PROMPT_ENCODE' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('SELECT');
  const [newCheckoutDate, setNewCheckoutDate] = useState<Date | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extensionApplied, setExtensionApplied] = useState(false);

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

  const { provider } = useLodgeCoreProvider();

  const handlePreview = async () => {
    if (!newCheckoutDate) return;
    setPhase('PROCESSING');
    setErrorMsg(null);
    try {
      const res = await provider.reservations.previewExtendStay(reservation.id, newCheckoutDate.toISOString());
      if (!res.success) { setPhase('FAILED'); setErrorMsg(res.error?.message || res.error || 'Preview failed'); return; }
      setPreviewData(res.data);
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
      const res = await provider.reservations.extendStay(reservation.id, newCheckoutDate.toISOString());
      if (!res.success) { setPhase('FAILED'); setErrorMsg(res.error?.message || res.error || 'Extension failed'); return; }
      setExtensionApplied(true);
      setPhase('PROMPT_ENCODE');
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    }
  };

  const formatMoney = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', maximumFractionDigits: 0 }).format(amount);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if ((phase === 'PROCESSING' || phase === 'ENCODING') && !val) return;
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50/50 rounded-2xl flex flex-col max-h-[90vh]">
        <div className="bg-white px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Extend Stay</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  Adjust check-out date for room {formatRoomNumber(reservation.reservationRooms?.[0]?.room?.number || reservation.roomNumber)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-6 bg-slate-50/50 overflow-y-auto flex-1">
          {phase === 'SELECT' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Check-Out</p>
                  <p className="font-semibold text-slate-900">{format(currentCheckOut, 'EEEE, MMM do, yyyy')}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300" />
                <div className="text-right">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">New Check-Out</p>
                  <p className="font-semibold text-slate-900">
                    {newCheckoutDate ? format(newCheckoutDate, 'EEEE, MMM do, yyyy') : 'Select date'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Select New Check-Out Date</label>
                <div className="w-full">
                  <DatePicker
                    value={newCheckoutDate}
                    onChange={setNewCheckoutDate}
                    placeholder="Pick a date..."
                    disabledDays={(date) => date <= minDate}
                  />
                </div>
                <p className="text-xs text-slate-500 font-medium">Must be after the current check-out date.</p>
              </div>
            </div>
          )}

          {phase === 'PREVIEW' && previewData && (
            <div className="space-y-5">
              <Card className="border-0 shadow-md bg-white rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">Financial Summary</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Additional Nights</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{previewData.additionalNights}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Rate per Night</span>
                    <span className="font-semibold text-slate-800">{formatMoney(Number(previewData.ratePerNight), previewData.currency)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-4 mt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Total Additional Charge</span>
                    <span className="font-black text-xl text-emerald-600">{formatMoney(previewData.additionalCharge, previewData.currency)}</span>
                  </div>
                </div>
              </Card>

              <div className="flex gap-3 p-4 rounded-xl text-sm border border-amber-200 bg-amber-50 text-amber-800 shadow-sm items-start">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <p className="font-medium leading-relaxed">This amount is an estimate. Room charges for the extended nights will be automatically posted to the guest&apos;s folio during the nightly audit. You will be prompted to encode their key card next.</p>
              </div>
            </div>
          )}

          {phase === 'PROMPT_ENCODE' && (
            <div className="flex flex-col items-center py-10 space-y-4 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-inner">
                <CreditCard className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-2xl text-slate-900 tracking-tight">Stay Extended</p>
                <p className="text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                  Please place the guest&apos;s key card on the encoder to update their check-out time.
                </p>
              </div>
            </div>
          )}

          {(phase === 'PROCESSING' || phase === 'ENCODING') && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">
                {phase === 'ENCODING' ? 'Place the guest card on the encoder to update its checkout time...' : 'Processing extension...'}
              </p>
            </div>
          )}

          {phase === 'SUCCESS' && (
            <div className="flex flex-col items-center py-10 space-y-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-2xl text-slate-900 tracking-tight">Stay Extended!</p>
                <p className="text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                  The reservation has been successfully extended and the key card updated.
                </p>
              </div>
            </div>
          )}

          {phase === 'FAILED' && (
            <div className="flex flex-col items-center py-10 space-y-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center shadow-inner">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-2xl text-slate-900 tracking-tight">Extension Failed</p>
                <p className="text-red-500 font-medium mt-2 max-w-[280px] mx-auto leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white px-6 py-4 border-t border-slate-100 shrink-0">
          <DialogFooter className="flex w-full sm:justify-between gap-2">
            {phase === 'SELECT' && (
              <>
                <DialogClose render={
                  <Button variant="outline" className="rounded-xl h-12 px-6 font-semibold border-slate-200">Cancel</Button>
                } />
                <Button 
                  onClick={handlePreview} 
                  disabled={!newCheckoutDate || newCheckoutDate <= minDate}
                  className="rounded-xl h-12 px-8 font-semibold bg-blue-600 hover:bg-blue-700 ml-auto"
                >
                  Calculate Charges
                </Button>
              </>
            )}
            {phase === 'PREVIEW' && (
              <>
                <Button variant="outline" onClick={() => setPhase('SELECT')} className="rounded-xl h-12 px-6 font-semibold border-slate-200">Back</Button>
                <Button onClick={handleConfirmExtend} className="rounded-xl h-12 px-8 font-semibold bg-emerald-600 hover:bg-emerald-700 ml-auto">
                  Confirm Extension
                </Button>
              </>
            )}
            {phase === 'PROMPT_ENCODE' && (
              <>
                <DialogClose render={
                  <Button variant="outline" className="rounded-xl h-12 px-6 font-semibold border-slate-200">Skip / Do Later</Button>
                } />
                <Button onClick={handleEncodeCard} className="rounded-xl h-12 px-8 font-semibold bg-blue-600 hover:bg-blue-700 ml-auto">
                  Encode Key Card
                </Button>
              </>
            )}
            {phase === 'FAILED' && (
              <>
                <DialogClose render={
                  <Button variant="outline" className="rounded-xl h-12 px-6 font-semibold border-slate-200">Close</Button>
                } />
                <Button onClick={extensionApplied ? handleEncodeCard : handlePreview} className="rounded-xl h-12 px-8 font-semibold bg-blue-600 hover:bg-blue-700 ml-auto">
                  {extensionApplied ? 'Retry Keycard' : 'Try Again'}
                </Button>
              </>
            )}
            {phase === 'SUCCESS' && (
              <DialogClose render={
                <Button className="w-full rounded-xl h-12 font-semibold bg-slate-900 hover:bg-slate-800 text-lg">
                  Done
                </Button>
              } />
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

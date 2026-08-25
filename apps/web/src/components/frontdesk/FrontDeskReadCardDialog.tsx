'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, Info, User, CheckCircle2, Key, Clock, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';

interface FrontDeskReadCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function FrontDeskReadCardDialog({ open, onOpenChange, propertyId }: FrontDeskReadCardDialogProps) {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();
  const [step, setStep] = useState<'IDLE' | 'READING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [cardInfo, setCardInfo] = useState<any>(null);
  const [reservation, setReservation] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setStep('IDLE');
      setErrorMsg('');
      setCardInfo(null);
      setReservation(null);
    }
  }, [open]);

  const handleReadCard = async () => {
    setStep('READING');
    setErrorMsg('');
    try {
      const data = await provider.keycards.read();
      
      const opId = data.data.operation.id;
      
      let readData = null;
      // We still poll just in case the provider uses polling (like in a cloud fallback scenario).
      // On desktop, the first poll will instantly return the result from memory.
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

      if (!readData) throw new Error('Timed out waiting for card read or card is empty');
      setCardInfo(readData);

      if (readData.roomNo) {
        try {
          const lData = await provider.reservations.lookupByRoom(readData.roomNo, propertyId);
          if (lData) {
            setReservation({
              ...lData,
              id: lData.id || lData.reservationId,
              primaryGuest: lData.primaryGuest || lData.guest || null,
            });
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
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50/50 rounded-3xl border-slate-200 shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-8 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <CreditCard className="w-6 h-6 text-indigo-100" />
              </div>
              Key Card Diagnostic
            </DialogTitle>
          </DialogHeader>
          <p className="text-indigo-200 mt-2 font-medium">Scan any hotel key card to view its current encoded data and active guest assignment.</p>
        </div>

        <div className="p-8">
          {step === 'IDLE' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="absolute -inset-4 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
                <div className="bg-indigo-50 p-6 rounded-full border border-indigo-100 shadow-sm relative">
                  <Key className="h-12 w-12 text-indigo-600" />
                </div>
              </div>
              <div className="space-y-2 max-w-[280px]">
                <h3 className="text-lg font-bold text-slate-900">Ready to Scan</h3>
                <p className="text-sm text-slate-500 font-medium">Place the card flat on the hardware encoder and press the button below.</p>
              </div>
              <Button onClick={handleReadCard} size="lg" className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5">
                Scan Card Now
              </Button>
            </div>
          )}

          {step === 'READING' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-500">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-indigo-600/50" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Scanning Hardware...</h3>
                <p className="text-sm text-slate-500 font-medium">Please do not remove the card from the encoder.</p>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && cardInfo && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              
              {/* Encoded Hardware Data */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-slate-900">Encoded Card Data</h4>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Number</span>
                    <p className="font-mono text-xl text-slate-900 font-bold">{formatRoomNumber(cardInfo.roomNo) || 'None'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Serial Number</span>
                    <p className="font-mono text-base text-slate-700 mt-1">{cardInfo.cardSnr || cardInfo.CardSnr || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valid From</span>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <LogIn className="w-4 h-4 text-emerald-500" />
                      {cardInfo.checkIn ? format(new Date(cardInfo.checkIn), 'PPp') : 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valid Until</span>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <LogOut className="w-4 h-4 text-rose-500" />
                      {cardInfo.checkOut ? format(new Date(cardInfo.checkOut), 'PPp') : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* PMS Lookup Result */}
              {reservation ? (
                <div className="bg-blue-50/80 rounded-2xl border border-blue-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-blue-100 bg-blue-100/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-900">Matching Reservation Found</h4>
                    </div>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase",
                      reservation.status === 'CHECKED_IN' ? "bg-emerald-100 text-emerald-700" :
                      reservation.status === 'CHECKED_OUT' ? "bg-slate-200 text-slate-700" :
                      "bg-blue-200 text-blue-800"
                    )}>
                      {(reservation.status || 'ACTIVE').replace('_', ' ')}
                    </span>
                  </div>
                  <div className="p-5 flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-blue-800/60 uppercase tracking-wider">Primary Guest</span>
                      <p className="font-bold text-blue-950 text-lg flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {reservation.primaryGuest?.firstName || reservation.guest?.firstName || 'Guest'} {reservation.primaryGuest?.lastName || reservation.guest?.lastName || ''}
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/frontdesk/reservations/detail?id=${reservation.id || reservation.reservationId}`);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                    >
                      Manage Folio
                    </Button>
                  </div>
                </div>
              ) : cardInfo.roomNo ? (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 flex items-start gap-4">
                  <div className="bg-amber-100 p-2 rounded-full mt-0.5">
                    <Info className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">No Active Reservation Found</h4>
                    <p className="text-sm text-amber-800/80 mt-1">This card is encoded for Room {formatRoomNumber(cardInfo.roomNo)}, but there is no currently checked-in reservation assigned to this room in the system.</p>
                  </div>
                </div>
              ) : null}

              <div className="pt-4 flex justify-center">
                <Button variant="outline" onClick={() => setStep('IDLE')} className="rounded-xl px-8 border-slate-300 font-bold text-slate-700 hover:bg-slate-100">
                  Scan Another Card
                </Button>
              </div>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-500">
              <div className="bg-red-50 p-6 rounded-full border border-red-100 relative">
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Hardware Error</h3>
                <p className="text-sm font-medium text-red-600 max-w-[300px] leading-relaxed mx-auto bg-red-50 p-3 rounded-lg border border-red-100">{errorMsg}</p>
              </div>
              <Button variant="outline" onClick={() => setStep('IDLE')} className="mt-4 rounded-xl px-8 border-slate-300">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreditCard, Loader2, AlertCircle, Info, User, CheckCircle2, Key, LogIn, LogOut, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
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
    if (open) { setStep('IDLE'); setErrorMsg(''); setCardInfo(null); setReservation(null); }
  }, [open]);

  const handleReadCard = async () => {
    setStep('READING'); setErrorMsg('');
    try {
      const data = await provider.keycards.read();
      const opId = data.data.operation.id;
      let readData = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await provider.hardware.poll(opId);
        if (!pRes.success) throw new Error(pRes.error?.message || 'Failed to poll hardware status');
        const op = pRes.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') { readData = op.command?.responseData; break; }
        else if (op?.status === 'FAILED' || op?.status === 'ERROR') throw new Error(op.errorMessage || 'Failed to read card');
      }
      if (!readData) throw new Error('Timed out waiting for card read or card is empty');
      setCardInfo(readData);
      if (readData.roomNo) {
        try {
          const lData = await provider.reservations.lookupByRoom(readData.roomNo, propertyId);
          if (lData) setReservation({ ...lData, id: lData.id || lData.reservationId, primaryGuest: lData.primaryGuest || lData.guest || null });
        } catch (e) { console.error('Failed to lookup reservation', e); }
      }
      setStep('SUCCESS');
    } catch (err: any) { setErrorMsg(err.message); setStep('ERROR'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] bg-[#0a0f1c] text-slate-200">
        
        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-7 pb-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Key Card Diagnostic</h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">Scan any card to view encoded guest data</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 p-6">

          {step === 'IDLE' && (
            <div className="py-10 flex flex-col items-center justify-center gap-6 text-center animate-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-ping opacity-60" />
                <div className="relative w-24 h-24 bg-indigo-500/10 border border-indigo-500/25 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(99,102,241,0.4)]">
                  <Key className="h-10 w-10 text-indigo-400" />
                </div>
              </div>
              <div className="max-w-[260px]">
                <h3 className="text-lg font-bold text-white mb-2">Ready to Scan</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Place the card flat on the hardware encoder then press the button below.</p>
              </div>
              <button onClick={handleReadCard} className="h-12 px-8 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_28px_-5px_rgba(99,102,241,0.7)] transition-all hover:-translate-y-0.5">
                Scan Card Now
              </button>
            </div>
          )}

          {step === 'READING' && (
            <div className="py-14 flex flex-col items-center justify-center gap-5 text-center animate-in fade-in duration-300">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-indigo-500/15 rounded-full animate-ping" />
                <div className="relative w-full h-full bg-indigo-500/10 border border-indigo-500/25 rounded-full flex items-center justify-center">
                  <Loader2 className="h-9 w-9 text-indigo-400 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Scanning Hardware…</h3>
                <p className="text-sm text-slate-400 font-medium">Please do not remove the card from the encoder.</p>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && cardInfo && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              {/* Card data */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/8 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-bold text-white text-sm">Encoded Card Data</h4>
                </div>
                <div className="p-5 grid grid-cols-2 gap-5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Room Number</span>
                    <p className="font-mono text-2xl font-black text-white mt-1">{formatRoomNumber(cardInfo.roomNo) || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Serial Number</span>
                    <p className="font-mono text-sm text-slate-300 mt-1.5">{cardInfo.cardSnr || cardInfo.CardSnr || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Valid From</span>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400 mt-1.5">
                      <LogIn className="w-4 h-4" />
                      {cardInfo.checkIn ? format(new Date(cardInfo.checkIn), 'dd MMM yy HH:mm') : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Valid Until</span>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-400 mt-1.5">
                      <LogOut className="w-4 h-4" />
                      {cardInfo.checkOut ? format(new Date(cardInfo.checkOut), 'dd MMM yy HH:mm') : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* PMS Lookup */}
              {reservation ? (
                <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-500/15">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-emerald-300 text-sm">Matching Reservation Found</h4>
                    </div>
                    <span className={cn(
                      'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border',
                      reservation.status === 'CHECKED_IN' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10',
                    )}>
                      {(reservation.status || 'ACTIVE').replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-5">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Primary Guest</span>
                      <p className="font-bold text-white text-base flex items-center gap-2 mt-1">
                        <User className="w-4 h-4 text-slate-400" />
                        {reservation.primaryGuest?.firstName || reservation.guest?.firstName || 'Guest'} {reservation.primaryGuest?.lastName || reservation.guest?.lastName || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { onOpenChange(false); router.push(`/frontdesk/reservations/detail?id=${reservation.id || reservation.reservationId}`); }}
                      className="h-9 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 transition-all"
                    >
                      Manage Folio
                    </button>
                  </div>
                </div>
              ) : cardInfo.roomNo ? (
                <div className="rounded-2xl bg-amber-500/8 border border-amber-500/20 p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm">No Active Reservation Found</h4>
                    <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">Card is encoded for Room {formatRoomNumber(cardInfo.roomNo)}, but no checked-in reservation is assigned to this room.</p>
                  </div>
                </div>
              ) : null}

              <div className="pt-1 flex justify-center">
                <button onClick={() => setStep('IDLE')} className="h-10 px-7 rounded-xl font-bold text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                  Scan Another Card
                </button>
              </div>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="py-12 flex flex-col items-center justify-center gap-5 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="h-9 w-9 text-red-400" />
              </div>
              <div className="max-w-[300px]">
                <h3 className="text-lg font-bold text-white mb-3">Hardware Error</h3>
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3 leading-relaxed">{errorMsg}</p>
              </div>
              <button onClick={() => setStep('IDLE')} className="h-10 px-7 rounded-xl font-bold text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                Try Again
              </button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

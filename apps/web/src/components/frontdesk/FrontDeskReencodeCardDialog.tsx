'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, AlertCircle, CheckCircle2, KeySquare, Search, ArrowRight, X, ChevronLeft } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';
import { cn } from '@/lib/utils';

interface FrontDeskReencodeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function FrontDeskReencodeCardDialog({ open, onOpenChange, propertyId }: FrontDeskReencodeCardDialogProps) {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();

  const [phase, setPhase] = useState<'SELECT' | 'PROMPT_ENCODE' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('SELECT');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [encodeOperationId, setEncodeOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['frontdesk', 'reencode-search', propertyId, searchQuery],
    queryFn: async () => {
      const res = await provider.reservations.list(propertyId, { status: 'CHECKED_IN', search: searchQuery || undefined, limit: 10 });
      return res?.data?.data || res?.data || [];
    },
    enabled: open && phase === 'SELECT',
  });

  useEffect(() => {
    if (open) {
      setPhase('SELECT'); setSearchQuery(''); setSelectedReservation(null);
      setEncodeOperationId(null); setErrorMsg(null); setHardwareStatus('');
    }
  }, [open]);

  useEffect(() => {
    if (phase !== 'ENCODING' || !encodeOperationId) return;
    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(encodeOperationId);
        if (!data || data.error) throw new Error('Failed to poll operation status');
        const status = data.data.operation.status;
        setHardwareStatus(status);
        if (status === 'SUCCESS' || status === 'COMPLETED') { setPhase('SUCCESS'); router.refresh(); }
        else if (status === 'FAILED') { setPhase('FAILED'); setErrorMsg(data.data.operation.errorMessage || 'Hardware agent failed to encode the card.'); }
      } catch (err) { console.error(err); }
    }, 1500);
    return () => clearInterval(interval);
  }, [phase, encodeOperationId, router, provider.hardware]);

  const handleSelectReservation = (reservation: any) => { setSelectedReservation(reservation); setPhase('PROMPT_ENCODE'); };

  const handleStartEncode = async () => {
    try {
      setPhase('ENCODING'); setHardwareStatus('STARTING'); setErrorMsg(null);
      if (selectedReservation?.status !== 'CHECKED_IN') { setPhase('FAILED'); setErrorMsg('Cards can only be encoded for checked-in reservations.'); return; }
      const roomId = selectedReservation?.reservationRooms?.[0]?.room?.id || selectedReservation?.reservationRooms?.[0]?.roomId;
      if (!roomId) { setPhase('FAILED'); setErrorMsg('Reservation has no assigned room.'); return; }
      const data = await provider.keycards.encode(roomId, '', selectedReservation.id);
      if (!data || data.error) { setPhase('FAILED'); setErrorMsg(data?.error?.message || 'Failed to initiate encode.'); return; }
      setEncodeOperationId(data.data.operation.id);
      setHardwareStatus(data.data.operation.status);
    } catch (err: unknown) {
      setPhase('FAILED'); setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const getStatusText = () => {
    switch (hardwareStatus) {
      case 'QUEUED': return 'Command sent to queue…';
      case 'DISPATCHING': return 'Waiting for Windows Agent to pick up…';
      case 'WAITING_FOR_CARD': return 'Place a blank card on the USB encoder now.';
      case 'CARD_DETECTED': return 'Card detected. Processing…';
      case 'VERIFYING_CARD': return 'Verifying encoder…';
      case 'ENCODING': return 'Writing room and expiry to card…';
      default: return hardwareStatus || 'Initializing…';
    }
  };

  const roomName = selectedReservation?.reservationRooms?.[0]?.room?.number || 'Unassigned';
  const guestName = `${selectedReservation?.primaryGuest?.firstName || ''} ${selectedReservation?.primaryGuest?.lastName || ''}`.trim();
  const initials = guestName.split(' ').map((n: string) => n[0] ?? '').join('').substring(0, 2).toUpperCase() || 'G';

  return (
    <Dialog open={open} onOpenChange={(val) => { if (phase === 'ENCODING' && !val) return; onOpenChange(val); }}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] bg-[#0a0f1c] text-slate-200 flex flex-col max-h-[90vh]">

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-600/8 rounded-full blur-3xl" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-7 pb-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            {phase === 'PROMPT_ENCODE' && (
              <button onClick={() => setPhase('SELECT')} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors mr-1">
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <KeySquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Re-Encode Key Card</h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">Create a new key for an in-house guest</p>
            </div>
          </div>
          {phase !== 'ENCODING' && (
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 overflow-hidden min-h-[380px] flex flex-col">

          {/* SELECT PHASE */}
          {phase === 'SELECT' && (
            <div className="flex flex-col h-full overflow-hidden p-6 animate-in fade-in duration-200">
              <div className="relative mb-5 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  placeholder="Search checked-in guests by name or room…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Searching guests…</p>
                  </div>
                ) : !searchResults?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
                    <KeySquare className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-semibold">No checked-in guests found.</p>
                  </div>
                ) : (
                  searchResults.map((res: any) => {
                    const name = `${res.primaryGuest?.firstName || ''} ${res.primaryGuest?.lastName || ''}`.trim() || 'Guest';
                    const inits = name.split(' ').map((n: string) => n[0] ?? '').join('').substring(0, 2).toUpperCase();
                    const hue = (res.primaryGuest?.firstName?.charCodeAt(0) ?? 0) % 4;
                    const avatarCls = ['bg-indigo-500/20 text-indigo-300', 'bg-emerald-500/20 text-emerald-300', 'bg-violet-500/20 text-violet-300', 'bg-amber-500/20 text-amber-300'][hue];
                    return (
                      <button
                        key={res.id}
                        onClick={() => handleSelectReservation(res)}
                        className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-indigo-500/30 transition-all text-left"
                      >
                        <div className={cn('w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm', avatarCls)}>{inits}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Room {formatRoomNumber(res.reservationRooms?.[0]?.room?.number)} · Out: {res.checkOut ? new Date(res.checkOut).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PROMPT_ENCODE PHASE */}
          {phase === 'PROMPT_ENCODE' && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-10 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-2xl font-black text-indigo-300 mb-6 shadow-[0_0_30px_-8px_rgba(99,102,241,0.4)]">
                {initials}
              </div>
              <h3 className="text-2xl font-black text-white mb-1">{guestName}</h3>
              <p className="text-slate-400 font-semibold text-lg mb-8">Room {roomName}</p>

              <div className="w-full p-5 rounded-2xl bg-white/[0.04] border border-white/8 mb-8 text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Instructions</p>
                <p className="text-sm text-slate-400 leading-relaxed">Place a new or blank card flat on the USB hardware encoder before pressing <strong className="text-white">Encode Key</strong>.</p>
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Cancel</button>
                <button onClick={handleStartEncode} className="flex-[2] h-12 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_28px_-5px_rgba(99,102,241,0.7)] transition-all flex items-center justify-center gap-2">
                  Encode Key <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ENCODING PHASE */}
          {phase === 'ENCODING' && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-10 text-center animate-in fade-in duration-300">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
                <div className="relative w-full h-full bg-indigo-500/10 border-2 border-indigo-500/30 rounded-full flex items-center justify-center shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]">
                  <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Encoding Card…</h3>
              <p className="text-slate-400 font-medium">{getStatusText()}</p>
            </div>
          )}

          {/* SUCCESS PHASE */}
          {phase === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-10 text-center animate-in zoom-in-95 duration-300">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 bg-emerald-500/15 rounded-full" />
                <div className="relative w-full h-full bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-white mb-2">Key Created!</h3>
              <p className="text-slate-400 mb-8 max-w-[280px] leading-relaxed">
                The key card for <strong className="text-white">{guestName}</strong> in Room <strong className="text-white">{roomName}</strong> is ready to use.
              </p>
              <button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all">
                Done
              </button>
            </div>
          )}

          {/* FAILED PHASE */}
          {phase === 'FAILED' && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-10 text-center animate-in slide-in-from-bottom-4 duration-300">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-red-500/10 rounded-full" />
                <div className="relative w-full h-full bg-red-500/10 border-2 border-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-9 w-9 text-red-400" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Encoding Failed</h3>
              <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 text-left">
                <p className="text-sm text-red-300 font-medium break-words leading-relaxed">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Close</button>
                <button onClick={handleStartEncode} className="flex-1 h-12 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-all">Try Again</button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertCircle, Key, ArrowRight, Wallet, LogIn, X, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';
import { FrontDeskAddPaymentDialog } from './FrontDeskAddPaymentDialog';
import { formatCurrency } from '@/lib/utils';
import { BypassCheckInModal } from './BypassCheckInModal';

interface FrontDeskCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string | null;
  propertyId: string;
}

export function FrontDeskCheckInDialog({ open, onOpenChange, reservationId, propertyId }: FrontDeskCheckInDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();
  
  const [phase, setPhase] = useState<'IDLE' | 'READING' | 'OVERWRITE_CONFIRM' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingCardData, setExistingCardData] = useState<any>(null);
  const [isDepositOverride, setIsDepositOverride] = useState(false);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const [isCollectDepositOpen, setIsCollectDepositOpen] = useState(false);
  const [printStatus, setPrintStatus] = useState<'IDLE' | 'PRINTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [overrideCreds, setOverrideCreds] = useState<{ acknowledgedByStaffId?: string, reason?: string } | null>(null);

  const { data: resData, isLoading: isFetching } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      return await provider.reservations.get(reservationId);
    },
    enabled: !!reservationId && open,
  });

  const reservation = resData?.data;

  useEffect(() => {
    if (open) {
      setPhase('IDLE'); setOperationId(null); setErrorMsg(null); setExistingCardData(null);
      setIsDepositOverride(false); setShowManagerOverride(false); setIsCollectDepositOpen(false);
      setPrintStatus('IDLE');
    }
  }, [open, reservationId]);

  useEffect(() => {
    if (phase !== 'READING' || !operationId) return;
    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(operationId);
        const op = data.data.operation;
        if (op.status === 'SUCCESS' || op.status === 'COMPLETED') {
          const cardData = op.command?.responseData;
          if (cardData && cardData.checkOut && new Date(cardData.checkOut) > new Date()) {
            setExistingCardData(cardData); setPhase('OVERWRITE_CONFIRM');
          } else {
            executeCheckInEncoding();
          }
        } else if (op.status === 'FAILED' || op.status === 'ERROR') {
          setPhase('FAILED'); setErrorMsg(op.errorMessage || 'Hardware agent failed to read the card.');
        }
      } catch (err) { console.error(err); }
    }, 1500);
    return () => clearInterval(interval);
  }, [phase, operationId, overrideCreds]);

  useEffect(() => {
    if (phase !== 'ENCODING' || !operationId) return;
    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(operationId);
        const status = data.data.operation.status;
        if (status === 'SUCCESS' || status === 'COMPLETED') {
          setPhase('SUCCESS');
          queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
          queryClient.invalidateQueries({ queryKey: ['reservations'] });
          triggerPrint();
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED'); setErrorMsg(data.data.operation.errorMessage || 'Hardware agent failed to encode the card.');
        }
      } catch (err) { console.error(err); }
    }, 1500);
    return () => clearInterval(interval);
  }, [phase, operationId, queryClient, propertyId]);

  const handleStartCheckIn = async () => {
    try {
      setPhase('READING'); setErrorMsg(null);
      const data = await provider.keycards.read();
      if (!data || data.error) { setPhase('FAILED'); setErrorMsg(data?.error?.message || 'Failed to initiate read card'); return; }
      setOperationId(data.data.operation.id);
    } catch (err: any) { setPhase('FAILED'); setErrorMsg(err.message || 'Network error occurred'); }
  };

  const executeCheckInEncoding = async () => {
    try {
      setPhase('ENCODING'); setErrorMsg(null); setOperationId(null); 
      const data = await provider.reservations.checkIn(reservationId!, "System", "Device1", { 
        overrideDeposit: isDepositOverride,
        acknowledgedByStaffId: overrideCreds?.acknowledgedByStaffId,
        reason: overrideCreds?.reason
      });
      if (!data || data.error) { setPhase('FAILED'); setErrorMsg(data?.error?.message || 'Failed to initiate check-in'); return; }
      if (data.data?.operation?.id) {
        setOperationId(data.data.operation.id);
      } else {
        setPhase('SUCCESS');
        queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
        triggerPrint();
      }
    } catch (err: any) { setPhase('FAILED'); setErrorMsg(err.message || 'Network error occurred'); }
  };

  const handleOverrideAuthorized = (staffId: string, reason: string) => {
    setShowManagerOverride(false); setIsDepositOverride(true); setOverrideCreds({ acknowledgedByStaffId: staffId, reason });
  };

  const triggerPrint = async () => {
    if (!HardwareBridge.isAvailable()) return;
    setPrintStatus('PRINTING');
    try {
      const res = await HardwareBridge.printRegistrationCard({
        reservationId: reservationId!,
        guestName: `${reservation?.primaryGuest?.firstName} ${reservation?.primaryGuest?.lastName}`,
        checkInVersion: Date.now(), details: {}
      });
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      setPrintStatus(parsed?.success ? 'SUCCESS' : 'FAILED');
    } catch { setPrintStatus('FAILED'); }
  };

  const resRoom = reservation?.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation?.primaryGuest;
  const corporateAccount = reservation?.corporateAccount;
  const isCorporateDepositWaived = corporateAccount?.depositPolicy === 'WAIVED';
  
  let expectedCost = Number(reservation?.ratePlanSnapshot?.total ?? 0);
  if (reservation?.ratePlanSnapshot?.total == null && resRoom) {
    const baseRate = Number(reservation?.ratePlanSnapshot?.baseRate ?? resRoom?.rateAmount ?? room?.roomType?.baseRate ?? 0);
    const checkIn = reservation?.checkIn || resRoom?.checkIn;
    const checkOut = reservation?.checkOut || resRoom?.checkOut;
    const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
    expectedCost = baseRate * nights;
  }
  if (expectedCost > 0 && resRoom) {
    if (resRoom.discountType === 'FIXED_AMOUNT') expectedCost -= Number(resRoom.discountAmount || 0);
    else if (resRoom.discountType === 'PERCENTAGE') expectedCost -= expectedCost * (Number(resRoom.discountPercent || 0) / 100);
    else if (resRoom.discountType === 'COMPLIMENTARY') expectedCost = Math.max(0, expectedCost - Number(resRoom.discountAmount || 0));
    if (expectedCost < 0) expectedCost = 0;
  }
  const folio = reservation?.folios?.[0];
  const advanceDeposit = Number(folio?.availableCredit || 0);
  const totalPayments = Number(folio?.totalPayments || 0);
  const totalCharges = Number(folio?.totalCharges || 0);
  const availableCredit = advanceDeposit + (totalPayments - totalCharges);
  const isDepositSufficient = availableCredit >= expectedCost;
  
  const isReady = reservation?.status === 'CONFIRMED' && room && (isCorporateDepositWaived || isDepositSufficient || isDepositOverride);
  
  const guestName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();
  const initials = guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'G';
  const roomNum = room?.number ? formatRoomNumber(room.number) : 'Unassigned';

  return (
    <Dialog open={open && !!reservationId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] bg-[#0a0f1c] text-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-600/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-600/6 rounded-full blur-3xl" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-7 pb-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Check-In Guest</h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">Issue keycard and authorize stay</p>
            </div>
          </div>
          {phase !== 'ENCODING' && phase !== 'READING' && (
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 flex flex-col justify-center min-h-[300px]">
          
          {isFetching ? (
            <div className="flex flex-col items-center text-center gap-5 py-8 animate-in fade-in duration-300">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-slate-400 text-sm">Fetching reservation details…</p>
            </div>
          ) : !reservation ? (
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-5">
                <AlertCircle className="h-10 w-10 text-red-400" />
              </div>
              <p className="text-red-300 font-bold mb-6">Reservation not found.</p>
              <button onClick={() => onOpenChange(false)} className="h-12 px-8 rounded-xl font-bold text-sm text-white bg-white/10 border border-white/10">Close</button>
            </div>
          ) : (
            <>
              {phase === 'IDLE' && (
                <div className="animate-in fade-in zoom-in-95 duration-300 space-y-5">
                  {/* Info Card */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{guestName}</h3>
                        <p className="text-slate-400 text-xs font-medium mt-0.5">Folio #{reservation.confirmationNumber}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-sm">
                        {initials}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/8">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Room</p>
                        <p className="font-bold text-slate-300">{roomNum}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Check-Out</p>
                        <p className="font-bold text-slate-300">{reservation.checkOut ? format(new Date(reservation.checkOut), 'MMM d') : 'N/A'}</p>
                      </div>
                    </div>
                    
                    {corporateAccount && (
                      <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs flex flex-col gap-1">
                        <p className="font-bold text-blue-300">Corporate: {corporateAccount.name}</p>
                        <p className="text-blue-400/80">Deposit Policy: {isCorporateDepositWaived ? 'Waived' : 'Required'}</p>
                      </div>
                    )}
                  </div>

                  {!isReady ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex flex-col gap-4">
                      {!room ? (
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-amber-300 text-sm font-medium leading-relaxed">Guest is not ready for check-in. Please ensure they have a room assigned.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <Wallet className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-bold text-amber-300 text-sm">{corporateAccount ? 'Corporate Deposit Required' : 'Advance Deposit Required'}</p>
                              
                              <div className="mt-3 space-y-1.5 text-xs">
                                <div className="flex justify-between text-amber-300/70">
                                  <span>Expected Stay Cost</span>
                                  <span className="font-medium text-amber-300/90">{formatCurrency(expectedCost)}</span>
                                </div>
                                <div className="flex justify-between text-amber-300/70">
                                  <span>Available Credit</span>
                                  <span className={cn("font-medium", availableCredit > 0 ? "text-blue-400" : "text-amber-300/90")}>{formatCurrency(availableCredit)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-red-400 pt-1 border-t border-amber-500/20">
                                  <span>Shortfall</span>
                                  <span>{formatCurrency(Math.max(0, expectedCost - availableCredit))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsCollectDepositOpen(true)} className="flex-[3] h-10 rounded-xl font-bold text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 transition-colors">
                              Collect Deposit
                            </button>
                            {!corporateAccount && (
                              <button onClick={() => setShowManagerOverride(true)} className="flex-[2] h-10 rounded-xl font-bold text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors">
                                Bypass
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-5 mt-2">
                      <div className="relative">
                        <div className="absolute -inset-4 bg-blue-500/10 rounded-full animate-ping opacity-50" />
                        <div className="relative w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(59,130,246,0.4)]">
                          <Key className="h-8 w-8 text-blue-400" />
                        </div>
                      </div>
                      <div className="max-w-[260px]">
                        <h3 className="text-base font-bold text-white mb-1.5">Place Blank Card</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">Place a blank keycard on the encoder, then click below to encode and check-in.</p>
                      </div>
                      <button onClick={handleStartCheckIn} className="w-full h-12 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] transition-all flex items-center justify-center gap-2">
                        Encode Keycard <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(phase === 'READING' || phase === 'ENCODING') && (
                <div className="flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 bg-blue-500/15 rounded-full animate-ping" />
                    <div className="relative w-full h-full bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(59,130,246,0.4)]">
                      <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {phase === 'READING' && 'Reading Keycard…'}
                      {phase === 'ENCODING' && 'Encoding Keycard…'}
                    </h3>
                    <p className="text-sm text-slate-400 font-medium">Please do not remove the card</p>
                  </div>
                </div>
              )}

              {phase === 'OVERWRITE_CONFIRM' && (
                <div className="flex flex-col items-center text-center gap-5 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-2">
                    <AlertCircle className="h-8 w-8 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-3">Active Card Detected</h3>
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-left text-sm mb-6">
                      <p className="font-bold text-amber-300 mb-2">This card is currently active:</p>
                      <ul className="space-y-1.5 text-amber-400/80">
                        <li>• Room {existingCardData?.roomNo}</li>
                        <li>• Expires {format(new Date(existingCardData?.checkOut), 'PPP p')}</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => setPhase('IDLE')} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                      Cancel
                    </button>
                    <button onClick={() => executeCheckInEncoding()} className="flex-1 h-12 rounded-xl font-bold text-sm text-amber-950 bg-amber-500 hover:bg-amber-400 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)] transition-all">
                      Overwrite Card
                    </button>
                  </div>
                </div>
              )}

              {phase === 'SUCCESS' && (
                <div className="flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-300">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full" />
                    <div className="relative w-full h-full bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white mb-2">Check-In Complete</h3>
                    <p className="text-slate-400 text-sm max-w-[260px] leading-relaxed">{guestName} has been checked in and the keycard is ready.</p>
                  </div>

                  <div className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Printer className="w-4 h-4" />
                      <span className="font-medium">
                        {printStatus === 'PRINTING' && 'Printing Registration Card…'}
                        {printStatus === 'SUCCESS' && 'Registration Card Printed'}
                        {printStatus === 'FAILED' && 'Printer Unavailable'}
                        {printStatus === 'IDLE' && 'Print Skipped'}
                      </span>
                    </div>
                    {printStatus === 'FAILED' && (
                      <button onClick={triggerPrint} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Retry</button>
                    )}
                  </div>

                  <div className="flex gap-3 w-full">
                    <button onClick={() => router.push(`/frontdesk/reservations/${reservation.id}`)} className="flex-[2] h-12 rounded-xl font-bold text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                      View Folio
                    </button>
                    <button onClick={() => onOpenChange(false)} className="flex-[3] h-12 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-all">
                      Done
                    </button>
                  </div>
                </div>
              )}

              {phase === 'FAILED' && (
                <div className="flex flex-col items-center text-center gap-5 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-9 w-9 text-red-400" />
                  </div>
                  <div className="max-w-[300px]">
                    <h3 className="text-xl font-bold text-white mb-3">Check-In Failed</h3>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300 text-left break-words leading-relaxed">{errorMsg}</div>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Cancel</button>
                    <button onClick={() => setPhase('IDLE')} className="flex-1 h-12 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 transition-all">Try Again</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
      
      {folio && (
        <FrontDeskAddPaymentDialog
          open={isCollectDepositOpen}
          onOpenChange={setIsCollectDepositOpen}
          folio={folio}
          initialAmount={Math.max(0, expectedCost - availableCredit)}
          mode="deposit"
          onPaymentSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
            setIsCollectDepositOpen(false);
          }}
        />
      )}

      <BypassCheckInModal 
        isOpen={showManagerOverride} 
        propertyId={propertyId}
        onAuthorized={handleOverrideAuthorized} 
        onClose={() => setShowManagerOverride(false)} 
      />
    </Dialog>
  );
}

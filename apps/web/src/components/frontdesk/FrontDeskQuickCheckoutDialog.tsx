'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreditCard, Loader2, AlertCircle, CheckCircle2, Key, ArrowRight, Wallet, X, Printer } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { cn } from '@/lib/utils';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { ManagerOverrideModal } from '../pos/ManagerOverrideModal';

interface FrontDeskQuickCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  initialReservation?: any;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

export function FrontDeskQuickCheckoutDialog({ open, onOpenChange, propertyId, initialReservation }: FrontDeskQuickCheckoutDialogProps) {
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();
  const [step, setStep] = useState<'IDLE' | 'LOADING' | 'READING' | 'CONFIRMING' | 'CHECKING_OUT' | 'ERASING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [reservation, setReservation] = useState<any>(null);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const [printStatus, setPrintStatus] = useState<'IDLE' | 'PRINTING' | 'SUCCESS' | 'FAILED'>('IDLE');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setErrorMsg('');
      if (!initialReservation) { setReservation(null); setStep('IDLE'); return; }
      setReservation(initialReservation);
      const hasDetails = Boolean(
        initialReservation.primaryGuest && initialReservation.reservationRooms?.length &&
        (initialReservation.folios?.length || initialReservation.folio)
      );
      if (hasDetails) { setStep('CONFIRMING'); return; }
      setStep('LOADING');
      try {
        const result = await provider.reservations.get(initialReservation.id);
        const resolved = result?.data?.reservation || result?.data?.data || result?.data || result?.reservation || result;
        if (!resolved?.id) throw new Error('Unable to load reservation details');
        if (!cancelled) { setReservation(resolved); setStep('CONFIRMING'); }
      } catch (err: any) {
        if (!cancelled) { setErrorMsg(err.message || 'Unable to load details'); setStep('ERROR'); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, initialReservation, provider]);

  const handleReadCard = async () => {
    setStep('READING'); setErrorMsg('');
    try {
      const data = await provider.keycards.read();
      if (!data || data.error) throw new Error(data?.error?.message || 'Failed to trigger read');
      const opId = data.data.operation.id;
      let readData = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pData = await provider.hardware.poll(opId);
        const op = pData.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') { readData = op.command?.responseData; break; }
        else if (op?.status === 'FAILED' || op?.status === 'ERROR') throw new Error(op.errorMessage || 'Failed to read card');
      }
      if (!readData) throw new Error('Timed out waiting for card read');
      if (!readData.roomNo) throw new Error('Card does not contain a room number');
      const lData = await provider.reservations.lookupByRoom(readData.roomNo, propertyId);
      if (!lData || lData.error) throw new Error(lData?.error?.message || 'Failed to lookup reservation');
      const resolved = lData.data?.reservation || lData.data?.data || lData.data || lData.reservation || lData;
      if (!resolved?.id && !resolved?.reservationId) throw new Error(`No active reservation found for room ${readData.roomNo}`);
      setReservation({ ...resolved, id: resolved.id || resolved.reservationId, primaryGuest: resolved.primaryGuest || resolved.guest || null, reservationRooms: resolved.reservationRooms || resolved.rooms || [], folios: resolved.folios || (resolved.folio ? [resolved.folio] : []), balance: resolved.balance ?? resolved.folioBalance ?? 0 });
      setStep('CONFIRMING');
    } catch (err: any) { setErrorMsg(err.message); setStep('ERROR'); }
  };

  const handleCheckout = async (managerId?: string, managerPin?: string, reason?: string) => {
    if (!reservation) return;
    setStep('CHECKING_OUT');
    try {
      const data = await provider.reservations.checkOut(reservation.id, 'System', 'Device1', { managerId, managerPin, reason });
      if (!data || data.error) throw new Error(data?.error?.message || 'Checkout failed');
      setStep('ERASING');
      const cData = await provider.keycards.cancel();
      if (!cData || cData.error) throw new Error(cData?.error?.message || 'Failed to trigger cancel card');
      const opId = cData.data.operation.id;
      let erased = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pData = await provider.hardware.poll(opId);
        const op = pData.data?.operation;
        if (op?.status === 'SUCCESS' || op?.status === 'COMPLETED') { erased = true; break; }
        else if (op?.status === 'FAILED' || op?.status === 'ERROR') throw new Error('Checkout succeeded, but failed to erase card: ' + (op.errorMessage || 'Unknown hardware error'));
      }
      if (!erased) throw new Error('Checkout succeeded, but timed out waiting to erase card.');
      setStep('SUCCESS');
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      triggerPrint();
    } catch (err: any) {
      const msg = err.message || 'Checkout failed';
      if (msg.includes('CREDIT_LIMIT_EXCEEDED')) { setStep('CONFIRMING'); setShowManagerOverride(true); return; }
      setErrorMsg(msg); setStep('ERROR');
    }
  };

  const handleOverrideAuthorized = (managerId: string, managerPin: string, reason: string) => { setShowManagerOverride(false); handleCheckout(managerId, managerPin, reason); };

  const triggerPrint = async () => {
    if (!HardwareBridge.isAvailable() || !reservation) return;
    setPrintStatus('PRINTING');
    try {
      const folio = reservation.folios?.[0] || reservation.folio || {};
      const room = reservation.reservationRooms?.[0]?.room || {};
      const guest = reservation.primaryGuest || reservation.guest || {};
      const transactions = (folio.transactions || []).map((t: any) => ({ date: t.date || t.createdAt || new Date().toISOString(), description: t.description || t.type || 'Transaction', reference: t.reference || t.id || null, debitAmount: Number(t.debitAmount ?? t.debit ?? t.charge ?? 0), creditAmount: Number(t.creditAmount ?? t.credit ?? t.payment ?? 0), runningBalance: Number(t.runningBalance ?? 0) }));
      const res = await HardwareBridge.printGuestFolio({ guestName: `${guest.firstName || 'Guest'} ${guest.lastName || ''}`.trim(), roomNumber: room.number || room.code || 'Unassigned', folioNumber: folio.id || reservation.id, arrivalDate: reservation.checkIn || new Date().toISOString(), departureDate: reservation.checkOut || new Date().toISOString(), transactions, totalCharges: Number(folio.totalCharges || 0), totalPayments: Number(folio.totalPayments || 0), balanceDue: Number(folio.balance || 0), currency: folio.currency || 'NGN', propertyName: reservation.property?.name || 'LodgeCore', propertyAddress: reservation.property?.address, printedAt: new Date().toISOString() });
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      setPrintStatus(parsed?.success ? 'SUCCESS' : 'FAILED');
    } catch { setPrintStatus('FAILED'); }
  };

  // Folio.balance is the authoritative checkout balance. netBalance is a
  // legacy desktop-derived value and can represent an exhausted advance
  // deposit as a negative credit even when the persisted folio is settled.
  const balance = (reservation?.folios || []).reduce((total: number, folio: any) => total + Number(folio?.balance ?? 0), 0);
  const isUnpaid = balance > 0.01;
  const hasGuestCredit = balance < -0.01;

  const guestName = `${reservation?.primaryGuest?.firstName || reservation?.guest?.firstName || 'Guest'} ${reservation?.primaryGuest?.lastName || reservation?.guest?.lastName || ''}`.trim();
  const roomNum = reservation?.reservationRooms?.[0]?.room?.number || '';
  const initials = guestName.split(' ').map((n: string) => n[0] ?? '').join('').substring(0, 2).toUpperCase() || 'G';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] bg-[#0a0f1c] text-slate-200 flex flex-col max-h-[90vh]">

          {/* Ambient */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-600/8 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-600/6 rounded-full blur-3xl" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-7 pt-7 pb-5 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <Key className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Quick Checkout</h2>
                <p className="text-slate-500 text-xs font-medium mt-0.5">Read physical card to checkout guest</p>
              </div>
            </div>
            {step !== 'CHECKING_OUT' && step !== 'ERASING' && (
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 overflow-y-auto p-6 flex flex-col justify-center min-h-[300px]">

            {/* IDLE */}
            {step === 'IDLE' && (
              <div className="flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-300">
                <div className="relative">
                  <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-ping opacity-50" />
                  <div className="relative w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(99,102,241,0.4)]">
                    <CreditCard className="h-10 w-10 text-indigo-400" />
                  </div>
                </div>
                <div className="max-w-[260px]">
                  <h3 className="text-lg font-bold text-white mb-2">Place Card on Encoder</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Place the physical room key on the hardware encoder, then click below to read it.</p>
                </div>
                <button onClick={handleReadCard} className="h-12 px-8 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_28px_-5px_rgba(99,102,241,0.7)] transition-all hover:-translate-y-0.5 flex items-center gap-2">
                  Read Keycard <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* LOADING */}
            {step === 'LOADING' && (
              <div className="flex flex-col items-center text-center gap-5 animate-in fade-in duration-300">
                <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Loading Reservation…</h3>
                  <p className="text-sm text-slate-400">Preparing checkout details, please wait.</p>
                </div>
              </div>
            )}

            {/* READING / CHECKING_OUT / ERASING */}
            {(step === 'READING' || step === 'CHECKING_OUT' || step === 'ERASING') && (
              <div className="flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 bg-indigo-500/15 rounded-full animate-ping" />
                  <div className="relative w-full h-full bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(99,102,241,0.4)]">
                    <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {step === 'READING' && 'Connecting to Encoder…'}
                    {step === 'CHECKING_OUT' && 'Processing Checkout…'}
                    {step === 'ERASING' && 'Erasing Keycard…'}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">Please do not remove the card</p>
                </div>
              </div>
            )}

            {/* CONFIRMING */}
            {step === 'CONFIRMING' && reservation && (
              <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                {/* Guest card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/8">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 text-sm shrink-0">{initials}</div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-base truncate">{guestName}</h3>
                    {roomNum && <p className="text-slate-400 text-sm font-medium">Room {roomNum}</p>}
                  </div>
                </div>

                {/* Balance status */}
                {isUnpaid ? (
                  <div className="rounded-2xl bg-red-500/8 border border-red-500/20 p-4">
                    <div className="flex items-start gap-3">
                      <Wallet className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-red-300 text-sm">Outstanding Balance — Manager Required</p>
                        <p className="text-red-400/80 text-xs mt-1 mb-3 leading-relaxed">Guest must pay <strong className="text-red-300">{formatCurrency(balance)}</strong> before checkout can be processed.</p>
                        <p className="text-xs text-red-400/60 leading-relaxed mb-3">If the guest has walked out, contact a manager to process as a Skipper from the back-office checkout workflow.</p>
                        <button onClick={() => onOpenChange(false)} className="w-full h-9 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 transition-all">
                          Cancel & View Folio
                        </button>
                      </div>
                    </div>
                  </div>
                ) : hasGuestCredit ? (
                  <div className="rounded-2xl bg-indigo-500/8 border border-indigo-500/20 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-indigo-300 text-sm">Guest Credit: {formatCurrency(Math.abs(balance))}</p>
                      <p className="text-indigo-400/70 text-xs mt-1 leading-relaxed">Credit will be retained on the account and can be refunded or applied to a future stay.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-300 text-sm">Folio Settled</p>
                      <p className="text-emerald-400/70 text-xs mt-0.5">Guest is cleared for checkout.</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isUnpaid && (
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep('IDLE')} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Cancel</button>
                    <button
                      onClick={() => handleCheckout()}
                      className="flex-[2] h-12 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_28px_-5px_rgba(16,185,129,0.6)] transition-all"
                    >
                      {hasGuestCredit ? 'Check Out & Retain Credit' : 'Confirm Checkout'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SUCCESS */}
            {step === 'SUCCESS' && (
              <div className="flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-300">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-full" />
                  <div className="relative w-full h-full bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">Checkout Complete</h3>
                  <p className="text-slate-400 text-sm max-w-[260px] leading-relaxed">{guestName} has been checked out and the keycard is erased.</p>
                </div>

                <div className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Printer className="w-4 h-4" />
                    <span className="font-medium">
                      {printStatus === 'PRINTING' && 'Printing Folio…'}
                      {printStatus === 'SUCCESS' && 'Folio Printed'}
                      {printStatus === 'FAILED' && 'Printer Unavailable'}
                      {printStatus === 'IDLE' && 'Print Skipped'}
                    </span>
                  </div>
                  {printStatus === 'FAILED' && (
                    <button onClick={triggerPrint} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Retry</button>
                  )}
                </div>

                <button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl font-bold text-sm text-white bg-white/8 hover:bg-white/12 border border-white/10 transition-all">
                  Done
                </button>
              </div>
            )}

            {/* ERROR */}
            {step === 'ERROR' && (
              <div className="flex flex-col items-center text-center gap-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-9 w-9 text-red-400" />
                </div>
                <div className="max-w-[300px]">
                  <h3 className="text-xl font-bold text-white mb-3">Checkout Failed</h3>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300 text-left break-words leading-relaxed">{errorMsg}</div>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl font-bold text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Cancel</button>
                  <button onClick={() => setStep('IDLE')} className="flex-1 h-12 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-all">Try Again</button>
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
      <ManagerOverrideModal isOpen={showManagerOverride} actionName="City Ledger Checkout Override" onAuthorized={handleOverrideAuthorized} onCancel={() => setShowManagerOverride(false)} />
    </>
  );
}

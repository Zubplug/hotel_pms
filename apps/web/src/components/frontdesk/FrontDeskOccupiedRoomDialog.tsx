'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Loader2, Key, CalendarClock, CreditCard, User,
  ExternalLink, RefreshCw, LogOut, FileText, BedDouble,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatRoomNumber } from '@/lib/format-room';
import { useProperty } from '@/components/PropertyProvider';
import { FrontDeskExtendStayDialog } from './FrontDeskExtendStayDialog';
import { FrontDeskQuickCheckoutDialog } from './FrontDeskQuickCheckoutDialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

interface FrontDeskOccupiedRoomDialogProps {
  room: { id: string; number: string; status: string } | null;
  isOpen: boolean;
  onClose: () => void;
  isAuditorMode?: boolean;
}

import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function FrontDeskOccupiedRoomDialog({ room, isOpen, onClose, isAuditorMode = false }: FrontDeskOccupiedRoomDialogProps) {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();

  const [showExtendStay, setShowExtendStay] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showFolio, setShowFolio] = useState(false);

  const { data: resData, isLoading, isError, refetch } = useQuery({
    queryKey: ['active-reservation', room?.id],
    queryFn: async () => {
      const res = await provider.rooms.getActiveReservation(room!.id);
      if (res?.error) throw new Error(res.error.message || res.error || 'Failed to fetch active reservation');
      return res.data;
    },
    enabled: !!room?.id && isOpen && room.status === 'OCCUPIED',
  });

  if (!room || room.status !== 'OCCUPIED') return null;

  const handleViewReservation = (reservationId: string) => {
    onClose();
    router.push(`/frontdesk/reservations/detail?id=${reservationId}`);
  };

  const DIALOG_BG = { background: '#07090f' };
  const GLASS_BG = { background: 'rgba(255,255,255,0.03)' };

  return (
    <>
      <Dialog open={isOpen && !showFolio} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden border-white/[0.08] p-0 shadow-2xl sm:max-w-[460px]"
          style={{ ...DIALOG_BG, borderRadius: '24px' }}
        >
          {/* ── Header ── */}
          <div
            className="relative shrink-0 overflow-hidden px-7 py-7"
            style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(99,102,241,0.12) 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-sky-400/15 blur-3xl" />
            <DialogHeader className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/25 text-sky-300"
                    style={{ background: 'rgba(14,165,233,0.14)', boxShadow: '0 0 24px rgba(14,165,233,0.18)' }}
                  >
                    <BedDouble className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-sky-400/70">Occupied Room</p>
                    <DialogTitle className="mt-0.5 text-xl font-bold tracking-tight text-white">
                      Room {formatRoomNumber(room.number)}
                    </DialogTitle>
                  </div>
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">
                  OCCUPIED
                </span>
              </div>
              <DialogDescription className="sr-only">Guest commands and information</DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-14">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                <p className="mt-3 text-sm font-medium text-slate-500">Loading guest data…</p>
              </div>
            ) : isError || !resData ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-400">
                  <User className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold text-white">Occupancy record unavailable</h3>
                <p className="mt-1.5 max-w-[220px] text-xs text-slate-500">
                  The room is marked occupied but no active reservation was found.
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" /> Reconcile / Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Guest info */}
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] p-4" style={GLASS_BG}>
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {resData.guest.firstName[0]}{resData.guest.lastName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-white">
                      {resData.guest.firstName} {resData.guest.lastName}
                      {resData.guest.isVip && (
                        <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">VIP</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {resData.guest.email || resData.guest.phone || 'No contact info'}
                    </p>
                  </div>
                </div>

                {/* Stay dates */}
                <div className="grid grid-cols-2 gap-2">
                  {[['Check-in', resData.checkIn], ['Check-out', resData.checkOut]].map(([lbl, date]) => (
                    <div key={String(lbl)} className="rounded-2xl border border-white/[0.06] p-4 text-center" style={GLASS_BG}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{String(lbl)}</p>
                      <p className="mt-1.5 text-sm font-bold text-white">{format(new Date(String(date)), 'MMM do, yyyy')}</p>
                    </div>
                  ))}
                </div>

                {/* Folio balance */}
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] p-4" style={GLASS_BG}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-slate-400">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-300">Folio Balance</span>
                  </div>
                  <span className={`text-lg font-black tabular-nums ${resData.folioBalance > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: resData.currency || 'NGN', maximumFractionDigits: 0 }).format(resData.folioBalance)}
                  </span>
                </div>

                {/* Auditor: View Folio button */}
                {isAuditorMode && resData.folioId && (
                  <button
                    onClick={() => setShowFolio(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 py-3 text-sm font-bold text-indigo-300 transition-all hover:bg-indigo-400/20 hover:text-indigo-200"
                  >
                    <FileText className="h-4 w-4" /> View Folio <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Active keycard */}
                {resData.lockCredentials && resData.lockCredentials.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3 text-sm font-semibold text-emerald-300">
                    <Key className="h-4 w-4" /> Active Keycard Encoded
                  </div>
                )}

                {/* Frontdesk actions */}
                {!isAuditorMode && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="h-12 rounded-xl font-bold"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}
                        onClick={() => setShowExtendStay(true)}
                      >
                        <CalendarClock className="mr-2 h-4 w-4" /> Extend Stay
                      </Button>
                      <Button
                        className="h-12 rounded-xl font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#f1f5f9' }}
                        onClick={() => setShowCheckOut(true)}
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Checkout
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer: View Full Reservation (frontdesk only) ── */}
          {resData && !isAuditorMode && (
            <div className="shrink-0 border-t border-white/[0.06] px-6 py-4">
              <button
                onClick={() => handleViewReservation(resData.reservationId)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:text-slate-200"
              >
                View Full Reservation <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Folio dialog (auditor mode) ── */}
      {isAuditorMode && resData?.folioId && (
        <Dialog open={showFolio} onOpenChange={setShowFolio}>
          <DialogContent
            className="!h-[94vh] !w-[calc(100vw-2rem)] !max-w-[1400px] overflow-hidden border-white/[0.08] p-0 shadow-2xl"
            style={{ ...DIALOG_BG, borderRadius: '24px' }}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Guest folio</DialogTitle>
              <DialogDescription>Read-only guest folio for audit review</DialogDescription>
            </DialogHeader>
            <div className="h-full overflow-y-auto">
              <FolioDetailView folioId={resData.folioId} onBack={() => setShowFolio(false)} readOnly />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Sub-dialogs ── */}
      {resData && (
        <>
          <FrontDeskExtendStayDialog
            open={showExtendStay}
            onOpenChange={setShowExtendStay}
            reservation={{
              id: resData.reservationId,
              checkOut: resData.checkOut,
              reservationRooms: [{ room: { number: resData.room.number } }]
            }}
          />
          <FrontDeskQuickCheckoutDialog
            open={showCheckOut}
            onOpenChange={(open) => {
              setShowCheckOut(open);
              if (!open) onClose();
            }}
            propertyId={propertyId}
            initialReservation={{
              id: resData.reservationId,
              primaryGuest: resData.guest,
              reservationRooms: [{ room: { number: resData.room.number } }],
              folios: [{ balance: resData.folioBalance, currency: resData.currency }]
            }}
          />
        </>
      )}
    </>
  );
}

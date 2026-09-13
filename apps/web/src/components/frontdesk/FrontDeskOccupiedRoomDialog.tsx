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
import { Loader2, Key, CalendarClock, CreditCard, User, ExternalLink, RefreshCw, LogOut, FileText, BedDouble } from 'lucide-react';
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
  /** When true: uses dark glass styling and shows folio in dark mode */
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

  /* ── Night-Audit dark glass dialog ───────────────────────────────── */
  if (isAuditorMode) {
    return (
      <>
        <Dialog open={isOpen && !showFolio} onOpenChange={(open) => { if (!open) onClose(); }}>
          <DialogContent
            className="flex max-h-[90vh] flex-col overflow-hidden border-white/[0.08] p-0 shadow-2xl sm:max-w-[460px]"
            style={{ background: '#07090f', borderRadius: '24px' }}
          >
            {/* Header */}
            <div
              className="relative shrink-0 overflow-hidden px-7 py-7"
              style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.18) 0%,rgba(99,102,241,0.12) 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-sky-400/15 blur-3xl" />
              <DialogHeader className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/25 text-sky-300"
                      style={{ background: 'rgba(14,165,233,0.14)', boxShadow: '0 0 24px rgba(14,165,233,0.18)' }}>
                      <BedDouble className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-sky-400/70">Occupied Room</p>
                      <DialogTitle className="mt-0.5 text-xl font-bold tracking-tight text-white">Room {formatRoomNumber(room.number)}</DialogTitle>
                    </div>
                  </div>
                  <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">OCCUPIED</span>
                </div>
                <DialogDescription className="sr-only">Guest commands and information</DialogDescription>
              </DialogHeader>
            </div>

            {/* Body */}
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
                  <p className="mt-1.5 max-w-[220px] text-xs text-slate-500">The room is marked occupied but no active reservation was found.</p>
                  <button onClick={() => refetch()}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white">
                    <RefreshCw className="h-4 w-4" /> Reconcile / Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Guest */}
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                      {resData.guest.firstName[0]}{resData.guest.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        {resData.guest.firstName} {resData.guest.lastName}
                        {resData.guest.isVip && <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">VIP</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{resData.guest.email || resData.guest.phone || 'No contact info'}</p>
                    </div>
                  </div>
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2">
                    {[['Check-in', resData.checkIn], ['Check-out', resData.checkOut]].map(([lbl, d]) => (
                      <div key={String(lbl)} className="rounded-2xl border border-white/[0.06] p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{String(lbl)}</p>
                        <p className="mt-1.5 text-sm font-bold text-white">{format(new Date(String(d)), 'MMM do, yyyy')}</p>
                      </div>
                    ))}
                  </div>
                  {/* Balance */}
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-slate-400"><CreditCard className="h-4 w-4" /></span>
                      <span className="text-sm font-semibold text-slate-300">Folio Balance</span>
                    </div>
                    <span className={`text-lg font-black tabular-nums ${resData.folioBalance > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: resData.currency || 'NGN', maximumFractionDigits: 0 }).format(resData.folioBalance)}
                    </span>
                  </div>
                  {/* View Folio */}
                  {resData.folioId && (
                    <button onClick={() => setShowFolio(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 py-3 text-sm font-bold text-indigo-300 transition-all hover:bg-indigo-400/20">
                      <FileText className="h-4 w-4" /> View Folio <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Keycard */}
                  {resData.lockCredentials?.length > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3 text-sm font-semibold text-emerald-300">
                      <Key className="h-4 w-4" /> Active Keycard Encoded
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Folio dialog (dark) */}
        {resData?.folioId && (
          <Dialog open={showFolio} onOpenChange={setShowFolio}>
            <DialogContent className="!h-[94vh] !w-[calc(100vw-2rem)] !max-w-[1400px] overflow-hidden border-white/[0.08] p-0 shadow-2xl"
              style={{ background: '#07090f', borderRadius: '24px' }}>
              <DialogHeader className="sr-only">
                <DialogTitle>Guest folio</DialogTitle>
                <DialogDescription>Read-only guest folio for audit review</DialogDescription>
              </DialogHeader>
              <div className="h-full overflow-y-auto">
                <FolioDetailView folioId={resData.folioId} onBack={() => setShowFolio(false)} readOnly darkMode />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  /* ── Frontdesk light dialog (original design preserved) ──────────── */
  return (
    <>
      <Dialog open={isOpen && !showFolio} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2rem] border-0 shadow-2xl flex flex-col max-h-[90vh]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shrink-0">
            <DialogHeader>
              <div className="flex justify-between items-center mb-1">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">Room {formatRoomNumber(room.number)}</DialogTitle>
                <div className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wider">OCCUPIED</div>
              </div>
              <DialogDescription className="text-slate-400">Guest commands and information</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 bg-slate-50 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium text-sm">Loading guest data...</p>
              </div>
            ) : isError || !resData ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><User className="w-8 h-8 text-red-500" /></div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Occupancy record unavailable</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-[260px] mx-auto">The room is marked occupied but no active reservation was found.</p>
                <Button onClick={() => refetch()} variant="outline" className="rounded-xl border-slate-300 font-semibold">
                  <RefreshCw className="w-4 h-4 mr-2" /> Reconcile / Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-700">
                      {resData.guest.firstName[0]}{resData.guest.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">
                        {resData.guest.firstName} {resData.guest.lastName}
                        {resData.guest.isVip && <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">VIP</span>}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">{resData.guest.email || resData.guest.phone || 'No contact info'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-in</p>
                    <p className="font-bold text-slate-900">{format(new Date(resData.checkIn), 'MMM do, yyyy')}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-out</p>
                    <p className="font-bold text-slate-900">{format(new Date(resData.checkOut), 'MMM do, yyyy')}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><CreditCard className="w-5 h-5 text-slate-600" /></div>
                    <span className="font-semibold text-slate-700">Folio Balance</span>
                  </div>
                  <span className={`font-black text-lg ${resData.folioBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: resData.currency || 'NGN', maximumFractionDigits: 0 }).format(resData.folioBalance)}
                  </span>
                </div>
                {resData.lockCredentials?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <Key className="w-4 h-4" /><span>Active Keycard Encoded</span>
                  </div>
                )}
                <div className="pt-2 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="rounded-xl h-12 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm" onClick={() => setShowExtendStay(true)}>
                      <CalendarClock className="w-4 h-4 mr-2" /> Extend Stay
                    </Button>
                    <Button className="rounded-xl h-12 bg-slate-900 hover:bg-slate-800 font-bold shadow-sm" onClick={() => setShowCheckOut(true)}>
                      <LogOut className="w-4 h-4 mr-2" /> Checkout
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {resData && (
            <div className="bg-white p-4 border-t border-slate-100 shrink-0">
              <Button variant="ghost" className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold" onClick={() => handleViewReservation(resData.reservationId)}>
                View Full Reservation <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {resData && (
        <>
          <FrontDeskExtendStayDialog open={showExtendStay} onOpenChange={setShowExtendStay}
            reservation={{ id: resData.reservationId, checkOut: resData.checkOut, reservationRooms: [{ room: { number: resData.room.number } }] }} />
          <FrontDeskQuickCheckoutDialog open={showCheckOut} onOpenChange={(open) => { setShowCheckOut(open); if (!open) onClose(); }}
            propertyId={propertyId}
            initialReservation={{ id: resData.reservationId, primaryGuest: resData.guest, reservationRooms: [{ room: { number: resData.room.number } }], folios: [{ balance: resData.folioBalance, currency: resData.currency }] }} />
        </>
      )}
    </>
  );
}

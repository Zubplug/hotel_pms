'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertTriangle, ShieldCheck, DoorOpen, Users, LogOut,
  CheckCircle2, ChevronRight, FileText, Loader2, BedDouble,
} from 'lucide-react';
import { format } from 'date-fns';
import { getRoomAndGuestControl } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { FrontDeskOccupiedRoomDialog } from '@/components/frontdesk/FrontDeskOccupiedRoomDialog';
import { formatRoomNumber } from '@/lib/format-room';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';
import { FrontDeskReservationDetail } from '@/components/frontdesk/FrontDeskReservationDetail';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

const ReservationDetailModalContent = ({ reservationId, onClose }: { reservationId: string; onClose: () => void }) => {
  const { provider } = useLodgeCoreProvider();
  const { data: res, isLoading } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => provider.reservations.get(reservationId),
    enabled: !!reservationId,
  });
  if (isLoading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
    </div>
  );
  if (!res) return <div className="p-8 text-center text-sm text-rose-400">Failed to load reservation details.</div>;
  return (
    <div className="max-h-[85vh] overflow-y-auto p-1">
      <FrontDeskReservationDetail reservation={res.data || res} darkMode />
    </div>
  );
};

/* ── Room status colour map ──────────────────────────────────────────────── */
const ROOM_STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  OCCUPIED:    { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)',  text: '#a5b4fc', dot: '#6366f1' },
  AVAILABLE:   { bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.30)',  text: '#6ee7b7', dot: '#10b981' },
  DIRTY:       { bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.30)',  text: '#fcd34d', dot: '#f59e0b' },
  OUT_OF_ORDER:{ bg: 'rgba(244,63,94,0.09)',   border: 'rgba(244,63,94,0.30)',   text: '#fda4af', dot: '#f43f5e' },
  MAINTENANCE: { bg: 'rgba(244,63,94,0.09)',   border: 'rgba(244,63,94,0.30)',   text: '#fda4af', dot: '#f43f5e' },
};
const getRoomStyle = (status: string) => ROOM_STATUS_STYLE[status] ?? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: '#64748b', dot: '#475569' };

export default function NightAuditRoomsControlPage() {
  const { propertyId } = useProperty();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'FINANCIAL' | 'STATUS'>('ALL');
  const { provider } = useLodgeCoreProvider();
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [viewingFolioId, setViewingFolioId] = useState<string | null>(null);
  const [viewingReservationId, setViewingReservationId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['night-audit', 'rooms-control', propertyId],
    queryFn: () => getRoomAndGuestControl(propertyId),
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  const { data: allRoomsData } = useQuery({
    queryKey: ['frontdesk', 'rooms', propertyId],
    queryFn: () => provider.rooms.list(propertyId, { page: '1', pageSize: '100' } as any),
    enabled: !!propertyId,
  });

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={PAGE_BG}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-full px-5 pb-12 pt-8" style={PAGE_BG}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">
        Failed to load room control data. Please try again.
      </div>
    </div>
  );

  const {
    businessDate, pendingArrivals, pendingDepartures, noShows,
    unassignedArrivals, inHouseGuestCount, inHouseReservationCount,
    missingRoomCharges, folioBalanceExceptions, creditLimitExceptions,
    roomStatusMismatches, assignmentIntegrity, unbalancedFolios,
  } = data as any;

  const exceptionCount =
    pendingDepartures.length + missingRoomCharges.length +
    folioBalanceExceptions.length + roomStatusMismatches.length +
    unassignedArrivals.length + creditLimitExceptions.length +
    assignmentIntegrity.length + unbalancedFolios.length;

  const totalChecks = inHouseReservationCount + exceptionCount;
  const percentClear = totalChecks > 0 ? Math.round(((totalChecks - exceptionCount) / totalChecks) * 100) : 100;

  /* Build exceptions list */
  const exceptionsList: any[] = [];

  if (activeTab === 'ALL' || activeTab === 'PENDING') {
    pendingDepartures.forEach((r: any) => exceptionsList.push({
      type: 'Pending Departure', critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      details: `Room ${r.reservationRooms[0]?.room?.number || 'Unassigned'} · Departs Today`,
      actionLabel: 'Open Folio', onAction: () => setViewingFolioId(r.folios[0]?.id),
    }));
    unassignedArrivals.forEach((r: any) => exceptionsList.push({
      type: 'Unassigned Arrival', critical: false,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      details: 'Arriving Today',
      actionLabel: 'Assign Room', onAction: () => setViewingReservationId(r.id),
    }));
  }

  if (activeTab === 'ALL' || activeTab === 'FINANCIAL') {
    missingRoomCharges.forEach((r: any) => exceptionsList.push({
      type: 'Unposted Room Charge', critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      details: `Missing charge for ${format(new Date(businessDate), 'dd MMM')}`,
      actionLabel: 'Investigate',
      onAction: () => r.folios[0] ? setViewingFolioId(r.folios[0]?.id) : setViewingReservationId(r.id),
    }));
    folioBalanceExceptions.forEach((r: any) => exceptionsList.push({
      type: 'Departure Balance', critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      details: `Outstanding balance: ${formatCurrency(Number(r.folios[0]?.balance || 0), 'NGN')}`,
      actionLabel: 'Settle Balance', onAction: () => setViewingFolioId(r.folios[0]?.id),
    }));
    creditLimitExceptions.forEach((r: any) => exceptionsList.push({
      type: 'Credit Limit Breach', critical: false,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      details: `Balance ${formatCurrency(Number(r.folios[0]?.balance || 0), 'NGN')} exceeds limit ${formatCurrency(Number(r.corporateAccount?.creditLimit || 0), 'NGN')}`,
      actionLabel: 'View Folio', onAction: () => setViewingFolioId(r.folios[0]?.id),
    }));
    unbalancedFolios.forEach((e: any) => exceptionsList.push({
      type: 'Unsettled Folio', critical: true,
      guest: `${e.reservation.primaryGuest.firstName} ${e.reservation.primaryGuest.lastName}`,
      details: e.reason,
      actionLabel: 'View Folio', onAction: () => setViewingFolioId(e.reservation.folios[0]?.id),
    }));
  }

  if (activeTab === 'ALL' || activeTab === 'STATUS') {
    roomStatusMismatches.forEach((e: any) => exceptionsList.push({
      type: 'Room Status Mismatch', critical: false,
      guest: `Room ${e.room.number}`,
      details: e.reason,
      actionLabel: 'View Room', onAction: () => setSelectedRoom(e.room),
    }));
    assignmentIntegrity.forEach((e: any) => exceptionsList.push({
      type: 'Assignment Integrity', critical: false,
      guest: e.room ? `Room ${e.room.number}` : 'Guest without room',
      details: e.reason,
      actionLabel: 'Investigate', onAction: () => setViewingReservationId(e.reservations[0]?.id),
    }));
  }

  const rawData = allRoomsData as any;
  const rooms: any[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);

  const TABS = [
    { id: 'ALL',      label: 'All Exceptions' },
    { id: 'PENDING',  label: 'Pending Actions' },
    { id: 'FINANCIAL',label: 'Financial' },
    { id: 'STATUS',   label: 'Status' },
  ];

  const SUMMARY_STATS = [
    { label: 'In-House Guests',       value: inHouseGuestCount,           icon: Users,    accent: 'border-indigo-400/20 bg-indigo-400/[0.09]', iconCls: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400' },
    { label: 'Arrivals Pending',      value: pendingArrivals.length,       icon: DoorOpen, accent: 'border-sky-400/20 bg-sky-400/[0.07]',    iconCls: 'border-sky-400/20 bg-sky-400/10 text-sky-400' },
    { label: 'Departures Pending',    value: pendingDepartures.length,     icon: LogOut,   accent: 'border-amber-400/20 bg-amber-400/[0.07]', iconCls: 'border-amber-400/20 bg-amber-400/10 text-amber-400' },
    { label: 'Unposted Room Charges', value: missingRoomCharges.length,    icon: FileText, accent: missingRoomCharges.length > 0 ? 'border-rose-400/25 bg-rose-400/[0.07]' : 'border-white/[0.06] bg-white/[0.025]', iconCls: missingRoomCharges.length > 0 ? 'border-rose-400/20 bg-rose-400/10 text-rose-400' : 'border-white/[0.07] bg-white/[0.04] text-slate-500' },
  ];

  const CRITICAL_CHECKS = [
    { label: 'Pending Departures',       count: pendingDepartures.length },
    { label: 'Unposted Room Charges',    count: missingRoomCharges.length },
    { label: 'Folio Balance Exceptions', count: folioBalanceExceptions.length },
    { label: 'Unsettled Folios',         count: unbalancedFolios.length },
  ];
  const WARNING_CHECKS = [
    { label: 'Room Status Mismatches', count: roomStatusMismatches.length },
    { label: 'Unassigned Arrivals',    count: unassignedArrivals.length },
    { label: 'Credit Limit Breaches',  count: creditLimitExceptions.length },
    { label: 'Assignment Integrity',   count: assignmentIntegrity.length },
  ];

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8" style={PAGE_BG}>
      <div className="mx-auto max-w-[1540px] space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Night Audit / Controls
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(6,182,212,0.12))', boxShadow: '0 0 24px rgba(14,165,233,0.15)' }}
              >
                <BedDouble className="h-5 w-5 text-sky-300" />
              </span>
              Room & Guest Control
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
              Business Date:
              <span className="font-mono font-bold text-slate-300">{format(new Date(businessDate), 'dd MMM yyyy')}</span>
            </p>
          </div>

          {/* Exception status badge */}
          <div className={`flex flex-col items-end rounded-[20px] border px-6 py-4 ${
            exceptionCount > 0 ? 'border-rose-400/25 bg-rose-400/[0.07]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'
          }`}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Audit Status</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${exceptionCount > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {exceptionCount} <span className="text-base font-semibold">exception{exceptionCount !== 1 ? 's' : ''}</span>
            </p>
            <p className={`mt-0.5 text-[11px] font-semibold ${percentClear === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {percentClear}% clear
            </p>
          </div>
        </header>

        {/* ── Stat cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_STATS.map(({ label, value, icon: Icon, accent, iconCls }) => (
            <div key={label} className={`flex items-center justify-between rounded-[20px] border p-5 ${accent}`}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-white tabular-nums">{value}</p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconCls}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          ))}
        </div>

        {/* ── Main grid: sidebar + exceptions panel ── */}
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">

          {/* Left: exception summary sidebar */}
          <div className="flex flex-col gap-4">

            {/* Critical */}
            <div className="rounded-[20px] border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400/80">Critical Exceptions</p>
              <div className="space-y-2">
                {CRITICAL_CHECKS.map(({ label, count }) => count > 0 ? (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                    </div>
                    <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">{count}</span>
                  </div>
                ) : null)}
                {CRITICAL_CHECKS.every(c => c.count === 0) && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">No critical exceptions</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warnings */}
            <div className="rounded-[20px] border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400/80">Warnings</p>
              <div className="space-y-2">
                {WARNING_CHECKS.map(({ label, count }) => count > 0 ? (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">{count}</span>
                  </div>
                ) : null)}
                {WARNING_CHECKS.every(c => c.count === 0) && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">No warnings</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: detailed exceptions panel */}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>

            {/* Tab bar */}
            <div className="flex items-center border-b border-white/[0.06] px-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-4 py-4 text-xs font-bold transition-colors ${
                    activeTab === tab.id
                      ? 'text-indigo-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Exceptions list */}
            <div className="max-h-[560px] overflow-y-auto p-4">
              {exceptionsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Everything looks good</h4>
                  <p className="mt-1 text-xs text-slate-500">No exceptions found in this category.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {exceptionsList.map((exc, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-2xl border p-4 ${
                        exc.critical
                          ? 'border-rose-400/15 bg-rose-400/[0.05]'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                            exc.critical
                              ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                              : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                          }`}>
                            {exc.critical ? <AlertTriangle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                            {exc.type}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">{exc.guest}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{exc.details}</p>
                      </div>
                      {exc.onAction && (
                        <button
                          onClick={exc.onAction}
                          className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-indigo-300 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10"
                        >
                          {exc.actionLabel}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Full Property View ── */}
        <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <BedDouble className="h-4 w-4 text-sky-400" />
              Full Property View
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Click any room tile to inspect occupancy details</p>
          </div>

          <div className="p-5">
            {/* Legend */}
            <div className="mb-4 flex flex-wrap items-center gap-4">
              {Object.entries(ROOM_STATUS_STYLE).map(([status, style]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: style.dot }} />
                  <span className="text-[10px] font-semibold text-slate-500">{status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>

            {rooms.length === 0 ? (
              <p className="text-sm text-slate-500">No rooms configured for this property.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                {rooms
                  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                  .map((room) => {
                    const style = getRoomStyle(room.status);
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className="group flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all hover:scale-[1.06] hover:shadow-lg"
                        style={{
                          background: style.bg,
                          borderColor: style.border,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
                        <span className="text-base font-bold leading-none" style={{ color: style.text }}>
                          {formatRoomNumber(room.number)}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: style.text, opacity: 0.6 }}>
                          {room.status.replace(/_/g, ' ')}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Dialogs */}
      <FrontDeskOccupiedRoomDialog
        room={selectedRoom}
        isOpen={!!selectedRoom && selectedRoom.status === 'OCCUPIED'}
        onClose={() => setSelectedRoom(null)}
        isAuditorMode={true}
      />

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} darkMode />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingReservationId} onOpenChange={(open) => !open && setViewingReservationId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingReservationId && <ReservationDetailModalContent reservationId={viewingReservationId} onClose={() => setViewingReservationId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

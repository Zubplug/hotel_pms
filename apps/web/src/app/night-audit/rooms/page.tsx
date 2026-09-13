'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, ShieldCheck, DoorOpen, Users, LogOut, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { getRoomAndGuestControl } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { FrontDeskOccupiedRoomDialog } from '@/components/frontdesk/FrontDeskOccupiedRoomDialog';
import { formatRoomNumber } from '@/lib/format-room';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';
import { FrontDeskReservationDetail } from '@/components/frontdesk/FrontDeskReservationDetail';
import Link from 'next/link';

const ReservationDetailModalContent = ({ reservationId, onClose }: { reservationId: string, onClose: () => void }) => {
  const { provider } = useLodgeCoreProvider();
  const { data: res, isLoading } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => provider.reservations.get(reservationId),
    enabled: !!reservationId,
  });

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>;
  if (!res) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl">Failed to load reservation details.</div>;

  return (
    <div className="max-h-[85vh] overflow-y-auto p-1">
      <FrontDeskReservationDetail reservation={res.data || res} />
    </div>
  );
};

export default function NightAuditRoomsControlPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'FINANCIAL' | 'STATUS'>('ALL');
  
  // For the Full Property View
  const { provider } = useLodgeCoreProvider();
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

  // For Modals
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
          Failed to load room control data. Please try again.
        </div>
      </div>
    );
  }

  const {
    businessDate,
    pendingArrivals,
    pendingDepartures,
    noShows,
    unassignedArrivals,
    inHouseGuestCount,
    inHouseReservationCount,
    missingRoomCharges,
    folioBalanceExceptions,
    creditLimitExceptions,
    roomStatusMismatches,
    assignmentIntegrity,
    unbalancedFolios,
  } = data as any;

  const exceptionCount = 
    pendingDepartures.length + 
    missingRoomCharges.length + 
    folioBalanceExceptions.length + 
    roomStatusMismatches.length + 
    unassignedArrivals.length + 
    creditLimitExceptions.length + 
    assignmentIntegrity.length + 
    unbalancedFolios.length;

  const totalChecks = inHouseReservationCount + exceptionCount; // simplistic denominator
  const percentClear = totalChecks > 0 ? Math.round(((totalChecks - exceptionCount) / totalChecks) * 100) : 100;

  const renderExceptionCard = (title: string, count: number, isCritical = false) => {
    if (count === 0) return null;
    return (
      <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm mb-2">
        <div className="flex items-center gap-3">
          {isCritical ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          {count}
        </span>
      </div>
    );
  };

  const exceptionsList: any[] = [];
  
  if (activeTab === 'ALL' || activeTab === 'PENDING') {
    pendingDepartures.forEach((r: any) => exceptionsList.push({
      type: 'Pending Departure',
      critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      resId: r.id,
      details: `Room ${r.reservationRooms[0]?.room?.number || 'Unassigned'} • Departs Today`,
      actionLabel: 'Open Folio',
      onAction: () => setViewingFolioId(r.folios[0]?.id)
    }));
    unassignedArrivals.forEach((r: any) => exceptionsList.push({
      type: 'Unassigned Arrival',
      critical: false,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      resId: r.id,
      details: `Arriving Today`,
      actionLabel: 'Assign Room',
      onAction: () => setViewingReservationId(r.id)
    }));
  }

  if (activeTab === 'ALL' || activeTab === 'FINANCIAL') {
    missingRoomCharges.forEach((r: any) => exceptionsList.push({
      type: 'Unposted Room Charge',
      critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      resId: r.id,
      details: `Missing charge for ${format(new Date(businessDate), 'dd MMM')}`,
      actionLabel: 'Investigate',
      onAction: () => r.folios[0] ? setViewingFolioId(r.folios[0]?.id) : setViewingReservationId(r.id)
    }));
    folioBalanceExceptions.forEach((r: any) => exceptionsList.push({
      type: 'Departure Balance',
      critical: true,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      resId: r.id,
      details: `Departure with outstanding balance: ${formatCurrency(Number(r.folios[0]?.balance || 0), 'NGN')}`,
      actionLabel: 'Settle Balance',
      onAction: () => setViewingFolioId(r.folios[0]?.id)
    }));
    creditLimitExceptions.forEach((r: any) => exceptionsList.push({
      type: 'Credit Limit Breach',
      critical: false,
      guest: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
      resId: r.id,
      details: `Balance ${formatCurrency(Number(r.folios[0]?.balance || 0), 'NGN')} exceeds limit ${formatCurrency(Number(r.corporateAccount?.creditLimit || 0), 'NGN')}`,
      actionLabel: 'View Folio',
      onAction: () => setViewingFolioId(r.folios[0]?.id)
    }));
    unbalancedFolios.forEach((e: any) => exceptionsList.push({
      type: 'Unsettled Folio',
      critical: true,
      guest: `${e.reservation.primaryGuest.firstName} ${e.reservation.primaryGuest.lastName}`,
      resId: e.reservation.id,
      details: e.reason,
      actionLabel: 'View Folio',
      onAction: () => setViewingFolioId(e.reservation.folios[0]?.id)
    }));
  }

  if (activeTab === 'ALL' || activeTab === 'STATUS') {
    roomStatusMismatches.forEach((e: any) => exceptionsList.push({
      type: 'Room Status Mismatch',
      critical: false,
      guest: `Room ${e.room.number}`,
      resId: e.room.id,
      details: e.reason,
      actionLabel: 'View Room',
      onAction: () => setSelectedRoom(e.room)
    }));
    assignmentIntegrity.forEach((e: any) => exceptionsList.push({
      type: 'Assignment Integrity',
      critical: false,
      guest: e.room ? `Room ${e.room.number}` : 'Guest without room',
      resId: e.reservations[0]?.id,
      details: e.reason,
      actionLabel: 'Investigate',
      onAction: () => setViewingReservationId(e.reservations[0]?.id)
    }));
  }

  const rawData = allRoomsData as any;
  const rooms: any[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen pb-24">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/night-audit')} 
            className="rounded-full h-10 px-4 shadow-sm border-slate-200 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-2 text-sm tracking-widest uppercase">
            Night Audit
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Room & Guest Control
          </h1>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            Business Date: <strong className="text-slate-800">{format(new Date(businessDate), 'dd MMM yyyy')}</strong>
          </p>
        </div>
        
        <div className="text-right">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-black ${exceptionCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {exceptionCount}
              </span>
              <span className="text-slate-600 font-medium">Exceptions</span>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <span className={`text-xl font-bold ${percentClear === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {percentClear}% Clear
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Ribbon */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
          <div className="text-slate-400 font-medium text-sm mb-1">In-House Guests</div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black">{inHouseGuestCount}</span>
            <Users className="w-8 h-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 font-medium text-sm mb-1">Arrivals Pending</div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-slate-900">{pendingArrivals.length}</span>
            <DoorOpen className="w-8 h-8 text-blue-100" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 font-medium text-sm mb-1">Departures Pending</div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-slate-900">{pendingDepartures.length}</span>
            <LogOut className="w-8 h-8 text-amber-100" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-slate-500 font-medium text-sm mb-1">Unposted Room Charges</div>
          <div className="flex items-end justify-between">
            <span className={`text-3xl font-black ${missingRoomCharges.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{missingRoomCharges.length}</span>
            <FileText className="w-8 h-8 text-red-100" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 mb-12">
        {/* Left Column: Exception Summaries */}
        <div className="col-span-4 space-y-8">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Critical Exceptions</h3>
            {renderExceptionCard('Pending Departures', pendingDepartures.length, true)}
            {renderExceptionCard('Unposted Room Charges', missingRoomCharges.length, true)}
            {renderExceptionCard('Folio Balance Exceptions', folioBalanceExceptions.length, true)}
            {renderExceptionCard('Unsettled Folios', unbalancedFolios.length, true)}
            
            {(pendingDepartures.length + missingRoomCharges.length + folioBalanceExceptions.length + unbalancedFolios.length) === 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" /> <span className="font-medium text-sm">No critical exceptions.</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Warnings</h3>
            {renderExceptionCard('Room Status Mismatches', roomStatusMismatches.length)}
            {renderExceptionCard('Unassigned Arrivals', unassignedArrivals.length)}
            {renderExceptionCard('Credit Limit Breaches', creditLimitExceptions.length)}
            {renderExceptionCard('Assignment Integrity', assignmentIntegrity.length)}
            
            {(roomStatusMismatches.length + unassignedArrivals.length + creditLimitExceptions.length + assignmentIntegrity.length) === 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" /> <span className="font-medium text-sm">No warnings.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed List */}
        <div className="col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center border-b border-slate-100 px-2">
            {[
              { id: 'ALL', label: 'All Exceptions' },
              { id: 'PENDING', label: 'Pending Actions' },
              { id: 'FINANCIAL', label: 'Financial' },
              { id: 'STATUS', label: 'Status' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto max-h-[600px]">
            {exceptionsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <ShieldCheck className="w-16 h-16 text-emerald-200 mb-4" />
                <h4 className="text-lg font-bold text-slate-800">Everything looks good</h4>
                <p className="text-slate-500 mt-1">No exceptions found in this category.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exceptionsList.map((exc, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${exc.critical ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${exc.critical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                          {exc.type}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">{exc.guest}</h4>
                      <p className="text-sm text-slate-500 font-medium">{exc.details}</p>
                    </div>
                    <div>
                      {exc.onAction && (
                        <Button variant="outline" className="bg-white hover:bg-slate-50" onClick={exc.onAction}>
                          {exc.actionLabel} <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Property View (Collapsible or bottom section) */}
      <div className="mt-16 pt-12 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
          Full Property View
        </h2>
        {rooms.length === 0 ? (
           <div className="text-slate-500">No rooms configured for this property.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
            {rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(room => (
              <div 
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`p-3 rounded-xl border shadow-sm cursor-pointer hover:border-indigo-400 transition-colors ${
                  room.status === 'OCCUPIED' ? 'bg-blue-50 border-blue-200' : 
                  room.status === 'AVAILABLE' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">{room.status}</div>
                <div className="text-xl font-black text-slate-900">{formatRoomNumber(room.number)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FrontDeskOccupiedRoomDialog
        room={selectedRoom}
        isOpen={!!selectedRoom && selectedRoom.status === 'OCCUPIED'}
        onClose={() => setSelectedRoom(null)}
        isAuditorMode={true}
      />

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="sm:max-w-6xl max-w-6xl h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingReservationId} onOpenChange={(open) => !open && setViewingReservationId(null)}>
        <DialogContent className="sm:max-w-6xl max-w-6xl h-[90vh] p-0 overflow-y-auto">
          {viewingReservationId && <ReservationDetailModalContent reservationId={viewingReservationId} onClose={() => setViewingReservationId(null)} />}
        </DialogContent>
      </Dialog>

    </div>
  );
}

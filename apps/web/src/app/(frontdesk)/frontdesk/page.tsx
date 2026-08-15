'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { CheckInDialog } from '@/components/reservations/CheckInDialog';
import { CheckOutDialog } from '@/components/reservations/CheckOutDialog';
import { LoadingState } from '@/components/ui/EmptyState';
import { 
  UserPlus, 
  CalendarPlus, 
  Search, 
  LogIn, 
  LogOut, 
  Users, 
  Key, 
  Hotel,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Ban,
  Clock,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { propertyId } = useProperty();

  const [checkInReservation, setCheckInReservation] = useState<any | null>(null);
  const [checkOutReservation, setCheckOutReservation] = useState<any | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['frontdesk', 'dashboard', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const response = await fetch(`/api/v1/frontdesk/dashboard?propertyId=${propertyId}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!propertyId,
    refetchInterval: 10000,
  });

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <Hotel className="w-16 h-16 text-slate-300" />
        <h2 className="text-2xl font-bold text-slate-700">No Property Selected</h2>
        <p className="text-slate-500">Please select a property from the top navigation to begin your shift.</p>
      </div>
    );
  }

  if (isLoading || !res?.data) {
    return <LoadingState message="Loading operational dashboard..." />;
  }

  const { kpis, hardware, arrivals, departures, businessDate } = res.data;
  const bDate = new Date(businessDate);
  const firstName = session?.user?.email?.split('@')[0] || 'Staff';
  
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
  };

  const renderRoomStatus = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
      case 'CLEAN':
        return <span className="text-emerald-600 font-medium text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> READY</span>;
      case 'DIRTY':
        return <span className="text-amber-600 font-medium text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> DIRTY — Housekeeping</span>;
      case 'OUT_OF_ORDER':
      case 'MAINTENANCE':
        return <span className="text-red-600 font-medium text-xs flex items-center gap-1"><Ban className="w-3 h-3"/> OUT OF ORDER</span>;
      case 'OCCUPIED':
        return <span className="text-blue-600 font-medium text-xs flex items-center gap-1"><Users className="w-3 h-3"/> OCCUPIED</span>;
      default:
        return <span className="text-slate-500 font-medium text-xs">{status.replace('_', ' ')}</span>;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              {greeting}, <span className="capitalize">{firstName}</span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-lg">
              {bDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          
          {/* Command Center - Floating Action Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Button onClick={() => router.push('/frontdesk/reservations/walk-in')} className="h-20 md:h-32 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 transform group-hover:scale-110 transition-transform"></div>
                <UserPlus className="w-8 h-8" />
                <span className="font-bold text-lg md:text-xl">Walk-In</span>
              </Button>

              <Button onClick={() => router.push('/frontdesk/reservations/new')} className="h-20 md:h-32 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 transform group-hover:scale-110 transition-transform"></div>
                <CalendarPlus className="w-8 h-8" />
                <span className="font-bold text-lg md:text-xl">New Reservation</span>
              </Button>

              <Button onClick={() => router.push('/frontdesk/reservations')} variant="outline" className="h-20 md:h-32 rounded-3xl bg-white/80 hover:bg-white text-slate-700 border-white/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col gap-2 group">
                <Search className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-lg md:text-xl">Search Guest</span>
              </Button>
            </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-blue-800 font-semibold text-sm uppercase tracking-wider">Arrivals</span>
              <div className="bg-blue-200/50 p-2 rounded-lg text-blue-700"><LogIn className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-blue-950">{kpis.arrivals}</span>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-6 rounded-2xl border border-orange-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-orange-800 font-semibold text-sm uppercase tracking-wider">Departures</span>
              <div className="bg-orange-200/50 p-2 rounded-lg text-orange-700"><LogOut className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-orange-950">{kpis.departures}</span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-800 font-semibold text-sm uppercase tracking-wider">In-House</span>
              <div className="bg-emerald-200/50 p-2 rounded-lg text-emerald-700"><Users className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-emerald-950">{kpis.inHouse}</span>
          </div>

          <div className="bg-gradient-to-br from-slate-100 to-slate-200/50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-700 font-semibold text-sm uppercase tracking-wider">Rooms</span>
              <div className="bg-slate-300/50 p-2 rounded-lg text-slate-700"><Key className="w-5 h-5" /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{kpis.roomsAvailable}</span>
              <span className="text-lg font-medium text-slate-500">/ {kpis.roomsTotal}</span>
            </div>
          </div>
        </div>

        {/* Main Operational Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ARRIVALS LIST */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden h-[600px]">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LogIn className="w-5 h-5 text-blue-600" /> Today's Arrivals
              </h2>
              <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">{arrivals.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {arrivals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Briefcase className="w-12 h-12 opacity-20" />
                  <p>No more arrivals today.</p>
                </div>
              ) : (
                arrivals.map((arr: any) => {
                  const initials = arr.guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                  const isPaid = arr.balance <= 0;
                  const isRoomReady = arr.roomStatus === 'AVAILABLE' || arr.roomStatus === 'CLEAN';
                  const canCheckIn = isPaid && isRoomReady && hardware.status === 'ONLINE' && arr.status === 'CONFIRMED';
                  
                  return (
                    <div key={arr.id} className="group bg-white border border-slate-100 hover:border-blue-100 hover:shadow-md hover:shadow-blue-50 transition-all rounded-2xl p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                        {initials}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-900 truncate pr-4">{arr.guestName}</h3>
                          <span className="font-mono text-xs text-slate-500 shrink-0">{arr.roomName}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          {/* Payment Status */}
                          {isPaid ? (
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Fully Paid</span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5"/> {formatCurrency(arr.balance)} Due</span>
                          )}
                          <span className="text-slate-300 text-xs">•</span>
                          {/* Room Status */}
                          {renderRoomStatus(arr.roomStatus)}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="shrink-0 pl-2 border-l border-slate-100">
                        {arr.status === 'CONFIRMED' ? (
                          <Button 
                            variant={canCheckIn ? "default" : "outline"}
                            size="sm"
                            className={cn("rounded-xl font-semibold px-4", canCheckIn ? "bg-blue-600 hover:bg-blue-700 text-white" : "")}
                            onClick={() => {
                              if (!isPaid) {
                                router.push(`/frontdesk/reservations/${arr.id}`); // View folio to pay
                              } else {
                                setCheckInReservation({ id: arr.id, folios: [{ balance: arr.balance }] });
                              }
                            }}
                          >
                            {isPaid ? 'Check In' : 'View Folio'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="rounded-xl px-4 bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => router.push(`/frontdesk/reservations/${arr.id}`)}>
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DEPARTURES LIST */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden h-[600px]">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-orange-600" /> Today's Departures
              </h2>
              <span className="bg-orange-100 text-orange-700 py-1 px-3 rounded-full text-xs font-bold">{departures.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {departures.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Briefcase className="w-12 h-12 opacity-20" />
                  <p>No more departures today.</p>
                </div>
              ) : (
                departures.map((dep: any) => {
                  const initials = dep.guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                  const isPaid = dep.balance <= 0;
                  
                  return (
                    <div key={dep.id} className="group bg-white border border-slate-100 hover:border-orange-100 hover:shadow-md hover:shadow-orange-50 transition-all rounded-2xl p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                        {initials}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-900 truncate pr-4">{dep.guestName}</h3>
                          <span className="font-mono text-xs text-slate-500 shrink-0">{dep.roomName}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          {isPaid ? (
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> ₦0 Due</span>
                          ) : (
                            <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5"/> {formatCurrency(dep.balance)} Due</span>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="shrink-0 pl-2 border-l border-slate-100">
                        {dep.status === 'CHECKED_IN' ? (
                          <Button 
                            variant={isPaid ? "default" : "outline"}
                            size="sm"
                            className={cn("rounded-xl font-semibold px-4", isPaid ? "bg-slate-900 hover:bg-slate-800 text-white" : "")}
                            onClick={() => {
                              if (!isPaid) {
                                router.push(`/frontdesk/reservations/${dep.id}`); // View folio to pay
                              } else {
                                setCheckOutReservation({ id: dep.id, folios: [{ balance: dep.balance }] });
                              }
                            }}
                          >
                            {isPaid ? 'Check Out' : 'View Folio'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="rounded-xl px-4 text-slate-400" disabled>
                            Departed
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Dialogs */}
      {checkInReservation && (
        <CheckInDialog
          open={!!checkInReservation}
          onOpenChange={(open) => !open && setCheckInReservation(null)}
          reservation={checkInReservation}
        />
      )}
      
      {checkOutReservation && (
        <CheckOutDialog
          open={!!checkOutReservation}
          onOpenChange={(open) => !open && setCheckOutReservation(null)}
          reservation={checkOutReservation}
          folio={checkOutReservation.folios[0]}
        />
      )}
    </div>
  );
}

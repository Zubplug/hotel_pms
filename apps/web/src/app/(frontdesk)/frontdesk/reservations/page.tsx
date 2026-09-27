'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { goBack } from '@/lib/frontdesk-navigation';
import { Search, User, LogIn, ArrowRight, Clock, ArrowLeft, CheckCircle2, UserPlus, CreditCard, Wallet, Landmark, CalendarCheck, Sparkles, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { format } from 'date-fns';
import { formatRoomNumber } from '@/lib/format-room';

interface Reservation {
  id: string;
  confirmationNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  primaryGuest: { firstName: string; lastName: string; phone?: string };
  reservationRooms: Array<{ room?: { number: string; status: string } | null; roomType?: { name: string } | null; }>;
  folio?: { balance: number };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
};

export default function FrontDeskReservationsPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const [activeFilter, setActiveFilter] = useState(filterParam || 'ALL');

  React.useEffect(() => {
    if (filterParam) setActiveFilter(filterParam);
  }, [filterParam]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Map our UI filters to the actual API status query
  const getStatusQuery = () => {
    switch (activeFilter) {
      case 'ARRIVALS': return 'CONFIRMED';
      case 'IN_HOUSE': return 'CHECKED_IN';
      // Departures and Unpaid might require custom API support or frontend filtering. 
      // We'll pass the status we know the API supports.
      default: return '';
    }
  };

  const { data: outboxData } = useQuery({
    queryKey: ['frontdesk', 'outboxEvents'],
    queryFn: async () => {
      if (provider.system?.getOutboxEvents) {
        return provider.system.getOutboxEvents();
      }
      return { success: false, data: [] };
    },
    refetchInterval: 5000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['frontdesk', 'reservations', { search: debouncedSearch, filter: activeFilter }],
    queryFn: async () => {
      if (activeFilter === 'GUEST_CREDITS') return { data: [] };
      const status = getStatusQuery();
      const params: any = {
        page: '1',
        pageSize: '50',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status ? { status } : {}),
      };
      return await provider.reservations.list(propertyId, params);
    },
  });


  const rawData = data as any;
  const reservations: Reservation[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);

  // Client-side filtering for complex filters that the API might not natively support yet
  const filteredReservations = reservations.filter(res => {
    if (res.status === 'CHECKED_OUT') {
      return false;
    }
    if (activeFilter === 'DEPARTURES') {
      const today = new Date().toISOString().split('T')[0];
      return res.status === 'CHECKED_IN' && res.checkOut.startsWith(today);
    }
    if (activeFilter === 'UNPAID') {
      return (res.folio?.balance || 0) > 0;
    }
    return true;
  });

  const arrivalsCount = reservations.filter(res => res.status === 'CONFIRMED').length;
  const inHouseCount = reservations.filter(res => res.status === 'CHECKED_IN').length;
  const unpaidCount = reservations.filter(res => Number(res.folio?.balance || 0) > 0).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      
      {/* Premium command header */}
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-[-130px] left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-[70px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3">
            <button onClick={() => goBack(router, '/frontdesk')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Back to previous screen"><ArrowLeft className="h-4 w-4" /></button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-indigo-300">Reservations</span>
            <span className="ml-auto hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live search</span>
          </div>
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-300/20 bg-indigo-400/15"><Sparkles className="h-3.5 w-3.5" /></span> Guest relationship desk</div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Reservation command center</h1>
              <p className="mt-2 text-sm text-slate-400">Find, filter, and move every guest stay forward from one calm workspace.</p>
            </div>
            <div className="flex gap-3">
          <Button 
            onClick={() => router.push('/frontdesk/reservations/walk-in')} 
            disabled={!isOnline}
            title={!isOnline ? "Internet Required" : ""}
            className="rounded-full h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm disabled:opacity-50"
          >
            <UserPlus className="mr-2 h-5 w-5" /> Walk-In
          </Button>
          <Button 
            onClick={() => router.push('/frontdesk/reservations/new')} 
            variant="outline" 
            disabled={!isOnline}
            title={!isOnline ? "Internet Required" : ""}
            className="rounded-full h-12 px-6 border-slate-200 font-bold shadow-sm disabled:opacity-50"
          >
            New Reservation
          </Button>
            </div>
          </div>
          <div className="mt-8 grid max-w-3xl grid-cols-3 gap-2 sm:gap-3">
            <HeaderMetric icon={CalendarCheck} label="Confirmed" value={arrivalsCount} />
            <HeaderMetric icon={LogIn} label="In-house" value={inHouseCount} />
            <HeaderMetric icon={CreditCard} label="Needs payment" value={unpaidCount} tone={unpaidCount > 0 ? 'amber' : 'emerald'} />
          </div>
        </div>
      </div>

      {/* Search Bar & Workstation Filters */}
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 animate-in fade-in duration-700 delay-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or confirmation number..."
            className="w-full pl-14 pr-6 py-4 text-lg font-medium rounded-2xl border-2 border-slate-100 bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: 'All Records' },
            { id: 'ARRIVALS', label: 'Arrivals' },
            { id: 'IN_HOUSE', label: 'In-House' },
            { id: 'DEPARTURES', label: 'Departures' },
            { id: 'UNPAID', label: 'Unpaid Balance', icon: CreditCard },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                activeFilter === filter.id 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.icon && <filter.icon className="w-4 h-4" />}
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Results Grid */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-3xl border border-slate-100">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No guests found</h3>
          <p className="text-slate-500">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {filteredReservations.map((res) => {
            const room = res.reservationRooms?.[0];
            const balance = res.folio?.balance || 0;
            const isUnpaid = balance > 0;
            const arrivalOverdue = res.status === 'CONFIRMED' && isArrivalOverdue(res);
            
            return (
              <Link href={`/frontdesk/reservations/detail?id=${res.id}`} key={res.id}>
                <div className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full">
                  
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${
                    res.status === 'CHECKED_IN' ? 'bg-blue-500' :
                    arrivalOverdue ? 'bg-red-500' :
                    res.status === 'CONFIRMED' ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                        {res.primaryGuest?.firstName?.[0]}{res.primaryGuest?.lastName?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{res.primaryGuest.firstName} {res.primaryGuest.lastName}</h3>
                        <p className="text-xs text-slate-500">{res.confirmationNumber}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors transform group-hover:translate-x-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Check-In</p>
                      <p className="font-medium text-slate-800 text-sm">{format(new Date(res.checkIn), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Room</p>
                      <p className="font-bold text-slate-900">{room?.room?.number ? formatRoomNumber(room.room.number) : 'TBA'} <span className="font-normal text-slate-500 text-sm ml-1">({room?.roomType?.name})</span></p>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t flex justify-between items-center">
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        res.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-800' :
                        res.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                      {res.status === 'CHECKED_IN' ? <LogIn className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {res.status}
                      </span>
                      {arrivalOverdue && (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          Arrival overdue
                        </span>
                      )}
                      {(() => {
                        const isDesktopMode = typeof window !== 'undefined' && !!(window as any).chrome?.webview;
                        if (!isDesktopMode) return null; // Web mode doesn't cache locally

                        const isDirty = (res as any).isDirty;
                        const outboxEvent = outboxData?.data?.find((e: any) => e.EntityId === res.id && e.Status !== 'SYNCED');

                        if (outboxEvent?.Status === 'CONFLICT') {
                           return (
                             <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1" title="Sync Conflict">
                               ⚠ Sync Conflict
                             </span>
                           );
                        }
                        
                        if (isDirty || outboxEvent) {
                          return (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1" title="Pending Sync">
                              ↑ Pending Sync
                            </span>
                          );
                        }

                        return (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 flex items-center gap-1" title="Served from local SQLite cache">
                            ☁ Cached
                          </span>
                        );
                      })()}
                    </div>
                    
                    {isUnpaid ? (
                      <span className="text-red-600 font-bold text-sm bg-red-50 px-3 py-1 rounded-full">
                        {formatCurrency(balance)} Due
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full">
                        Paid
                      </span>
                    )}
                  </div>

                </div>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

function HeaderMetric({ icon: Icon, label, value, tone = 'indigo' }: { icon: React.ElementType; label: string; value: number; tone?: 'indigo' | 'amber' | 'emerald' }) {
  const colors = tone === 'amber' ? 'text-amber-200 bg-amber-400/10 border-amber-300/15' : tone === 'emerald' ? 'text-emerald-200 bg-emerald-400/10 border-emerald-300/15' : 'text-indigo-200 bg-indigo-400/10 border-indigo-300/15';
  return <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${colors}`}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><span className="text-lg font-black text-white">{value}</span></span></div>;
}

function isArrivalOverdue(reservation: any) {
  if (!reservation.checkIn) return false;
  const checkIn = new Date(reservation.checkIn);
  if (Number.isNaN(checkIn.getTime())) return false;
  const cutoff = new Date(checkIn);
  cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(2, 0, 0, 0);
  return Date.now() >= cutoff.getTime();
}

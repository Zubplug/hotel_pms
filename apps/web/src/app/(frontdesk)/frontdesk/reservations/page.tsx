'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, User, LogIn, ArrowRight, Clock, ArrowLeft, CheckCircle2, UserPlus, CreditCard } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

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

  const { provider } = useLodgeCoreProvider();

  const { data, isLoading } = useQuery({
    queryKey: ['frontdesk', 'reservations', { search: debouncedSearch, filter: activeFilter }],
    queryFn: async () => {
      const status = getStatusQuery();
      const params: any = {
        page: '1',
        pageSize: '50', // Fetch more for workstation
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
    if (activeFilter === 'DEPARTURES') {
      const today = new Date().toISOString().split('T')[0];
      return res.status === 'CHECKED_IN' && res.checkOut.startsWith(today);
    }
    if (activeFilter === 'UNPAID') {
      return (res.folio?.balance || 0) > 0;
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen pb-24">
      
      {/* Header Actions */}
      <div className="flex justify-between items-start mb-8 animate-in slide-in-from-top-4 duration-500">
        <div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/frontdesk')} 
            className="rounded-full h-10 px-4 shadow-sm border-slate-200 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Guest Search</h1>
          <p className="text-slate-500 mt-1 font-medium">Find guests and manage their reservations instantly.</p>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={() => router.push('/frontdesk/reservations/walk-in')} className="rounded-full h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
            <UserPlus className="mr-2 h-5 w-5" /> Walk-In
          </Button>
          <Button onClick={() => router.push('/frontdesk/reservations/new')} variant="outline" className="rounded-full h-12 px-6 border-slate-200 font-bold shadow-sm">
            New Reservation
          </Button>
        </div>
      </div>

      {/* Search Bar & Workstation Filters */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 animate-in fade-in duration-700 delay-100">
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

      {/* Results Grid */}
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
            
            return (
              <Link href={`/frontdesk/reservations/detail?id=${res.id}`} key={res.id}>
                <div className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full">
                  
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${
                    res.status === 'CHECKED_IN' ? 'bg-blue-500' :
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      res.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-800' :
                      res.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {res.status === 'CHECKED_IN' ? <LogIn className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {res.status}
                    </span>
                    
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
  );
}

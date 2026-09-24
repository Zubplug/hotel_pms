'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { ArrowLeft, Search, Key, Sparkles, Wind, AlertTriangle, ShieldCheck, DoorOpen, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { formatRoomNumber } from '@/lib/format-room';
import { FrontDeskRoomStatusDialog } from '@/components/frontdesk/FrontDeskRoomStatusDialog';
import { FrontDeskOccupiedRoomDialog } from '@/components/frontdesk/FrontDeskOccupiedRoomDialog';

interface Room {
  id: string;
  number: string;
  status: string;
  housekeepingStatus: string;
  roomType: { name: string; code: string };
  floor: { name: string; number: number };
  building: { name: string };
}

export default function FrontDeskRoomsPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const { provider } = useLodgeCoreProvider();

  const { data, isLoading } = useQuery({
    queryKey: ['frontdesk', 'rooms', propertyId, { filter: activeFilter }],
    queryFn: async () => {
      const params: any = {
        page: '1',
        pageSize: '100', // API limit is 100
        ...(activeFilter !== 'ALL' && activeFilter !== 'DIRTY' && activeFilter !== 'CLEAN' ? { status: activeFilter } : {}),
        ...(activeFilter === 'DIRTY' ? { housekeepingStatus: 'DIRTY' } : {}),
        ...(activeFilter === 'CLEAN' ? { housekeepingStatus: 'CLEAN' } : {}),
      };
      return await provider.rooms.list(propertyId, params);
    },
    enabled: !!propertyId,
  });

  const rawData = data as any;
  const rooms: Room[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);

  const filteredRooms = rooms.filter(room => {
    if (search) {
      const q = search.toLowerCase();
      return room.number.toLowerCase().includes(q) || 
             (room.roomType?.name ?? 'Unknown Room Type').toLowerCase().includes(q);
    }
    return true;
  });

  const roomMetrics = {
    total: rooms.length,
    available: rooms.filter(room => room.status === 'AVAILABLE').length,
    occupied: rooms.filter(room => room.status === 'OCCUPIED').length,
    service: rooms.filter(room => ['DIRTY', 'MAINTENANCE', 'OUT_OF_ORDER'].includes(room.status) || ['DIRTY', 'IN_PROGRESS'].includes(room.housekeepingStatus)).length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'OCCUPIED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'OUT_OF_ORDER': return 'bg-red-100 text-red-800 border-red-200';
      case 'MAINTENANCE': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getHousekeepingIcon = (status: string) => {
    switch (status) {
      case 'CLEAN': return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'DIRTY': return <Wind className="w-4 h-4 text-red-500" />;
      case 'IN_PROGRESS': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'INSPECTED': return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      default: return <Sparkles className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-500/15 blur-[80px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3"><button onClick={() => router.push('/frontdesk')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Back to front desk"><ArrowLeft className="h-4 w-4" /></button><span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-cyan-300">Room board</span><span className="ml-auto hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live inventory</span></div>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/15"><DoorOpen className="h-3.5 w-3.5" /></span> Rooms & availability</div><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Property room board</h1><p className="mt-2 text-sm text-slate-400">See what is sellable, occupied, or waiting for service at a glance.</p></div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3"><RoomMetric icon={BedDouble} label="Total" value={roomMetrics.total} /><RoomMetric icon={Key} label="Ready" value={roomMetrics.available} tone="emerald" /><RoomMetric icon={DoorOpen} label="In-house" value={roomMetrics.occupied} tone="indigo" /><RoomMetric icon={Wind} label="Service" value={roomMetrics.service} tone="amber" /></div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8"><div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 animate-in fade-in duration-700 delay-100">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by room number or type..."
            className="w-full pl-14 pr-6 py-4 text-lg font-medium rounded-2xl border-2 border-slate-100 bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: 'All Rooms' },
            { id: 'AVAILABLE', label: 'Available' },
            { id: 'OCCUPIED', label: 'Occupied' },
            { id: 'DIRTY', label: 'Dirty' },
            { id: 'CLEAN', label: 'Clean' },
            { id: 'OUT_OF_ORDER', label: 'Out of Order' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeFilter === filter.id 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Room Grid */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-3xl border border-slate-100">
          <Key className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No rooms found</h3>
          <p className="text-slate-500">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {Object.entries(
            filteredRooms.reduce((acc, room) => {
              const key = `${room.building?.name || 'Main Building'} • Floor ${room.floor?.number || room.floor?.name || 'N/A'}`;
              if (!acc[key]) acc[key] = { floorNumber: room.floor?.number || 0, rooms: [] };
              acc[key].rooms.push(room);
              return acc;
            }, {} as Record<string, { floorNumber: number; rooms: Room[] }>)
          )
          .sort((a, b) => a[1].floorNumber - b[1].floorNumber)
          .map(([groupName, group]) => (
            <div key={groupName} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 text-slate-700 font-bold px-4 py-1.5 rounded-full text-sm border border-slate-200">
                  {groupName}
                </div>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {group.rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((room) => (
                  <div 
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all p-4 flex flex-col group cursor-pointer hover:-translate-y-1"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md border ${getStatusColor(room.status)}`}>
                        {room.status}
                      </span>
                      <div title={room.housekeepingStatus} className="bg-slate-50 p-1.5 rounded-full border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                        {getHousekeepingIcon(room.housekeepingStatus)}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                        {formatRoomNumber(room.number)}
                      </h3>
                      <div className="text-xs text-slate-500 font-medium tracking-wide">
                        {room.roomType?.name ?? 'Unknown Room Type'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      <FrontDeskRoomStatusDialog
        room={selectedRoom}
        isOpen={!!selectedRoom && selectedRoom.status !== 'OCCUPIED'}
        onClose={() => setSelectedRoom(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['frontdesk', 'rooms'] });
        }}
      />

      <FrontDeskOccupiedRoomDialog
        room={selectedRoom}
        isOpen={!!selectedRoom && selectedRoom.status === 'OCCUPIED'}
        onClose={() => setSelectedRoom(null)}
      />
    </div>
  );
}

function RoomMetric({ icon: Icon, label, value, tone = 'slate' }: { icon: React.ElementType; label: string; value: number; tone?: 'slate' | 'emerald' | 'indigo' | 'amber' }) {
  const colors = tone === 'emerald' ? 'text-emerald-200 bg-emerald-400/10 border-emerald-300/15' : tone === 'indigo' ? 'text-indigo-200 bg-indigo-400/10 border-indigo-300/15' : tone === 'amber' ? 'text-amber-200 bg-amber-400/10 border-amber-300/15' : 'text-slate-200 bg-white/[0.05] border-white/10';
  return <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center sm:min-w-[76px]"><span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${colors}`}><Icon className="h-3.5 w-3.5" /></span><span className="mt-1 text-lg font-black text-white">{value}</span><span className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span></div>;
}

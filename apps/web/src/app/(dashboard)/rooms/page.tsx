'use client';

import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BedDouble, Building2, CheckCircle2, Filter, KeyRound, LayoutGrid,
  List, Plus, Power, Search, ShieldAlert, Wrench,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRoomNumber } from '@/lib/format-room';
import { toast } from 'sonner';

interface Room {
  id: string;
  number: string;
  code: string;
  status: string;
  isActive: boolean;
  maintenanceStatus: string | null;
  maxAdults: number;
  maxChildren: number;
  roomType: { name: string; code: string } | null;
  building: { name: string } | null;
  floor: { number: number; name?: string | null } | null;
}

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'DIRTY', label: 'Dirty' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'OUT_OF_ORDER', label: 'Out of order' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

const statusTone: Record<string, string> = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  OCCUPIED: 'border-blue-200 bg-blue-50 text-blue-800',
  DIRTY: 'border-amber-200 bg-amber-50 text-amber-800',
  CLEANING: 'border-violet-200 bg-violet-50 text-violet-800',
  OUT_OF_ORDER: 'border-rose-200 bg-rose-50 text-rose-800',
  MAINTENANCE: 'border-orange-200 bg-orange-50 text-orange-800',
};

function SummaryCard({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail: string; icon: ElementType; tone: string }) {
  return <Card className="border-slate-200/80 shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

export default function RoomsPage() {
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await fetch('/api/v1/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      return (await res.json()).data as Room[];
    },
  });

  const rooms = data || [];
  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesSearch = !query || [room.number, room.code, room.roomType?.name, room.building?.name].filter(Boolean).join(' ').toLowerCase().includes(query);
      return matchesSearch && (status === 'ALL' || room.status === status);
    });
  }, [rooms, search, status]);

  const counts = useMemo(() => ({
    total: rooms.length,
    available: rooms.filter((room) => room.status === 'AVAILABLE').length,
    occupied: rooms.filter((room) => room.status === 'OCCUPIED').length,
    attention: rooms.filter((room) => ['DIRTY', 'CLEANING', 'OUT_OF_ORDER', 'MAINTENANCE'].includes(room.status) || (room.maintenanceStatus && room.maintenanceStatus !== 'NONE')).length,
  }), [rooms]);

  const toggleRoom = async (room: Room) => {
    setBusyRoomId(room.id);
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !room.isActive }) });
      if (!response.ok) throw new Error((await response.json()).error?.message || 'Unable to update room');
      toast.success(room.isActive ? 'Room disabled' : 'Room enabled', { description: `${formatRoomNumber(room.number)} is now ${room.isActive ? 'hidden from active inventory' : 'available in active inventory'}.` });
      await refetch();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update room'); }
    finally { setBusyRoomId(null); }
  };

  return <div className="min-h-full space-y-7 pb-10">
    <PageHeader title="Rooms" description="Monitor room readiness, occupancy, and maintenance across the property." actions={<Button className="gap-2" asChild><Link href="/rooms/new"><Plus className="h-4 w-4" />Add room</Link></Button>} />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total rooms" value={counts.total} detail="Active room inventory" icon={BedDouble} tone="bg-blue-100 text-blue-700" /><SummaryCard label="Available" value={counts.available} detail="Ready for assignment" icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" /><SummaryCard label="Occupied" value={counts.occupied} detail="Currently in-house" icon={KeyRound} tone="bg-violet-100 text-violet-700" /><SummaryCard label="Needs attention" value={counts.attention} detail="Cleaning or maintenance" icon={ShieldAlert} tone="bg-amber-100 text-amber-700" /></div>

    <Card className="border-slate-200/80 shadow-sm"><CardContent className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-1 flex-col gap-3 sm:flex-row"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room, type, building…" className="h-10 pl-9" /></div><Select value={status} onValueChange={(value) => value && setStatus(value)}><SelectTrigger className="w-full sm:w-[190px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filteredRooms.length}</span> of {rooms.length} rooms</p><div className="flex items-center rounded-lg border bg-muted/30 p-1"><Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Grid</span></Button><Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2" onClick={() => setView('list')}><List className="h-4 w-4" /><span className="sr-only sm:not-sr-only">List</span></Button></div></div></div></CardContent></Card>

    {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, index) => <Card key={index} className="h-40 animate-pulse border-slate-200 bg-muted/40" />)}</div> : isError ? <Card className="border-rose-200 bg-rose-50/50"><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><ShieldAlert className="h-8 w-8 text-rose-600" /><p className="font-semibold">Rooms could not be loaded</p><p className="text-sm text-muted-foreground">Check the connection and try again.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></CardContent></Card> : filteredRooms.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><KeyRound className="h-7 w-7 text-muted-foreground" /></div><p className="text-lg font-semibold">{rooms.length ? 'No matching rooms' : 'No rooms configured'}</p><p className="max-w-sm text-sm text-muted-foreground">{rooms.length ? 'Try clearing the search or choosing another status.' : 'Add the first room to begin managing room inventory.'}</p>{rooms.length === 0 && <Button asChild><Link href="/rooms/new"><Plus className="mr-2 h-4 w-4" />Add first room</Link></Button>}</CardContent></Card> : view === 'grid' ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{filteredRooms.map((room) => <Card key={room.id} className={`group relative overflow-hidden border-slate-200/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${!room.isActive ? 'opacity-65' : ''}`}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><Link href={`/rooms/${room.id}/edit`} className="min-w-0"><p className="text-2xl font-bold tracking-tight group-hover:text-primary">{formatRoomNumber(room.number)}</p><p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{room.roomType?.name || 'No room type'}</p></Link></div><div className="mt-4 flex flex-wrap gap-1.5"><Badge variant="outline" className={statusTone[room.status] || ''}>{room.status.replace(/_/g, ' ')}</Badge>{!room.isActive && <Badge variant="destructive">Disabled</Badge>}{room.floor && <Badge variant="outline" className="text-[10px]">Floor {room.floor.number}</Badge>}</div><div className="mt-4 border-t pt-3 text-xs text-muted-foreground">{room.maintenanceStatus && room.maintenanceStatus !== 'NONE' ? <span className="flex items-center gap-1.5 font-medium text-amber-700"><Wrench className="h-3.5 w-3.5" />{room.maintenanceStatus.replace(/_/g, ' ')}</span> : <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{room.building?.name || 'No building assigned'}</span>}<Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-xs" disabled={busyRoomId === room.id} onClick={() => toggleRoom(room)}><Power className="mr-1.5 h-3.5 w-3.5" />{busyRoomId === room.id ? 'Saving…' : room.isActive ? 'Disable room' : 'Enable room'}</Button></div></CardContent></Card>)}</div> : <Card className="border-slate-200/80 shadow-sm"><CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="text-base">Room inventory</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Room</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Maintenance</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{filteredRooms.map((room) => <tr key={room.id} className={`group hover:bg-muted/20 ${!room.isActive ? 'opacity-65' : ''}`}><td className="px-5 py-4"><Link href={`/rooms/${room.id}/edit`} className="font-semibold group-hover:text-primary">{formatRoomNumber(room.number)}</Link><p className="text-xs text-muted-foreground">{room.code || 'No code'}{!room.isActive && ' · Disabled'}</p></td><td className="px-5 py-4">{room.roomType?.name || 'No room type'}</td><td className="px-5 py-4 text-muted-foreground">{[room.building?.name, room.floor && `Floor ${room.floor.number}`].filter(Boolean).join(' · ') || 'Unassigned'}</td><td className="px-5 py-4"><StatusBadge status={room.status} /></td><td className="px-5 py-4 text-muted-foreground">{room.maintenanceStatus && room.maintenanceStatus !== 'NONE' ? room.maintenanceStatus.replace(/_/g, ' ') : 'Clear'}</td><td className="px-5 py-4 text-right"><Button variant={room.isActive ? 'ghost' : 'secondary'} size="sm" disabled={busyRoomId === room.id} onClick={() => toggleRoom(room)}><Power className="mr-1.5 h-3.5 w-3.5" />{busyRoomId === room.id ? 'Saving…' : room.isActive ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody></table></div></CardContent></Card>}
  </div>;
}

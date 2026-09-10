'use client';


import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, MapPin, Phone, Mail, BedDouble,
  Layers, Edit, ArrowRight, Wrench, Settings, Activity, Users, DoorClosed, Hotel,
  CalendarDays, ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface PropertyDetail {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email?: string;
  isActive: boolean;
  buildings: Array<{ id: string; name: string; _count?: { rooms: number } }>;
  _count: { rooms: number; roomTypes: number };
}

const unwrap = <T,>(value: any, fallback: T): T => value?.data ?? fallback;

const statusClass = (status: string) => {
  if (['CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'AVAILABLE', 'CLEAN'].includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (['CANCELLED', 'NO_SHOW', 'OUT_OF_ORDER', 'OVERDUE'].includes(status)) return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
};

function InlineLoading() {
  return <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Loading live data…</div>;
}

function EmptyTab({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/10 px-6 py-12 text-center"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div><p className="font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div>;
}

function PageControls({ meta, page, onPageChange }: { meta?: { total?: number; totalPages?: number }; page: number; onPageChange: (page: number) => void }) {
  const totalPages = meta?.totalPages ?? 1;
  if (totalPages <= 1) return null;
  return <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground"><span>{meta?.total ?? 0} total · Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button></div></div>;
}

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [roomsPage, setRoomsPage] = useState(1);
  const [reservationsPage, setReservationsPage] = useState(1);
  const [guestsPage, setGuestsPage] = useState(1);

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['properties', 'detail', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/properties/${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch property');
      const json = await res.json();
      return json.data as PropertyDetail;
    },
    enabled: !!propertyId,
  });

  const { data: roomsRes, isLoading: roomsLoading } = useQuery({
    queryKey: ['properties', propertyId, 'rooms', roomsPage],
    queryFn: async () => (await fetch(`/api/v1/rooms?propertyId=${propertyId}&page=${roomsPage}&pageSize=9`)).json(),
    enabled: !!propertyId,
  });
  const { data: reservationsRes, isLoading: reservationsLoading } = useQuery({
    queryKey: ['properties', propertyId, 'reservations', reservationsPage],
    queryFn: async () => (await fetch(`/api/v1/reservations?propertyId=${propertyId}&page=${reservationsPage}&pageSize=8`)).json(),
    enabled: !!propertyId,
  });
  const { data: guestsRes, isLoading: guestsLoading } = useQuery({
    queryKey: ['properties', propertyId, 'guests', guestsPage],
    queryFn: async () => (await fetch(`/api/v1/guests?propertyId=${propertyId}&paged=true&page=${guestsPage}&pageSize=10`)).json(),
    enabled: !!propertyId,
  });
  const { data: housekeepingRes, isLoading: housekeepingLoading } = useQuery({
    queryKey: ['properties', propertyId, 'housekeeping'],
    queryFn: async () => (await fetch(`/api/v1/housekeeping/tasks?propertyId=${propertyId}`)).json(),
    enabled: !!propertyId,
  });
  const { data: maintenanceRes, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['properties', propertyId, 'maintenance'],
    queryFn: async () => (await fetch(`/api/v1/maintenance/tickets?propertyId=${propertyId}`)).json(),
    enabled: !!propertyId,
  });
  const { data: receivablesRes, isLoading: receivablesLoading } = useQuery({
    queryKey: ['properties', propertyId, 'receivables'],
    queryFn: async () => (await fetch(`/api/v1/reports/receivables?propertyId=${propertyId}`)).json(),
    enabled: !!propertyId,
  });

  const rooms = unwrap<any[]>(roomsRes, []);
  const reservations = unwrap<any[]>(reservationsRes, []);
  const guests = unwrap<any[]>(guestsRes, []);
  const roomsMeta = roomsRes?.meta;
  const reservationsMeta = reservationsRes?.meta;
  const guestsMeta = guestsRes?.meta;
  const housekeepingTasks = unwrap<any[]>(housekeepingRes, []);
  const maintenanceTickets = maintenanceRes?.data?.tickets ?? maintenanceRes?.tickets ?? [];
  const receivables = receivablesRes?.data?.receivables ?? [];
  const roomStatusCounts = rooms.reduce((counts: Record<string, number>, room: any) => {
    counts[room.status] = (counts[room.status] || 0) + 1;
    return counts;
  }, {});
  const totalReceivables = receivables.reduce((sum: number, item: any) => sum + Number(item.financials?.balance || 0), 0);

  if (isLoading) return <LoadingState message="Loading property..." />;
  if (isError || !property) return <ErrorState description="Could not load property details." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={property.name}
        description={`${property.city}, ${property.country} · ${property.code}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/properties/${propertyId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Settings
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 -mx-6 px-6 pt-2 mb-6">
          <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start overflow-x-auto rounded-none border-b-0 pb-px">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Overview</TabsTrigger>
            <TabsTrigger value="rooms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Rooms & Types</TabsTrigger>
            <TabsTrigger value="reservations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Reservations</TabsTrigger>
            <TabsTrigger value="guests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Guests</TabsTrigger>
            <TabsTrigger value="operations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Operations</TabsTrigger>
            <TabsTrigger value="financials" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Financials</TabsTrigger>
            <TabsTrigger value="buildings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Buildings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Rooms', value: property._count.rooms, icon: BedDouble },
              { label: 'Room Types', value: property._count.roomTypes, icon: Layers },
              { label: 'Buildings', value: property.buildings.length, icon: Building2 },
              { label: 'Status', value: property.isActive ? 'Active' : 'Inactive', icon: Wrench, isBadge: true, active: property.isActive },
            ].map(({ label, value, icon: Icon, isBadge, active }) => (
              <Card key={label} className="border-muted/60 shadow-sm">
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {isBadge ? (
                      <Badge className={`mt-1 border-transparent ${active ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}`}>
                        {value}
                      </Badge>
                    ) : (
                      <p className="text-2xl font-bold">{value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-muted/60 shadow-sm">
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
                <CardDescription>Primary communication channels for this property.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{property.address}, {property.city}, {property.country}</span>
                </div>
                {property.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span>{property.phone}</span>
                  </div>
                )}
                {property.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span>{property.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted/60 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Quick Links</CardTitle>
                    <CardDescription>Jump straight to operational modules.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/housekeeping?propertyId=${propertyId}`}>
                      <Hotel className="h-5 w-5 text-primary" />
                      <span>Housekeeping</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/maintenance?propertyId=${propertyId}`}>
                      <Wrench className="h-5 w-5 text-primary" />
                      <span>Maintenance</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/reports?propertyId=${propertyId}`}>
                      <Activity className="h-5 w-5 text-primary" />
                      <span>Reports & KPIs</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2 justify-center" asChild>
                    <Link href={`/settings?propertyId=${propertyId}`}>
                      <Settings className="h-5 w-5 text-primary" />
                      <span>Settings</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="mt-0">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle>Rooms & Room Types</CardTitle><CardDescription className="mt-1">Live room inventory and current operating status.</CardDescription></div>
                <Button asChild variant="outline" size="sm"><Link href={`/rooms?propertyId=${propertyId}`}>View all rooms</Link></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {roomsLoading ? <InlineLoading /> : <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {['AVAILABLE', 'OCCUPIED', 'CLEANING', 'OUT_OF_ORDER'].map((status) => <div key={status} className="rounded-xl border bg-muted/20 p-3"><p className="text-xs font-medium text-muted-foreground">{status.replaceAll('_', ' ')}</p><p className="mt-1 text-2xl font-bold">{roomStatusCounts[status] || 0}</p></div>)}
                </div>
                {rooms.length === 0 ? <EmptyTab icon={<DoorClosed className="h-5 w-5" />} title="No rooms configured" description="Rooms added to this property will appear here." /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rooms.map((room: any) => <Link key={room.id} href={`/rooms/${room.id}`} className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"><div><p className="font-semibold">Room {room.number}</p><p className="text-xs text-muted-foreground">{room.roomType?.name || 'Room type not set'}</p></div><Badge className={`border-0 text-[10px] ${statusClass(room.status)}`}>{String(room.status).replaceAll('_', ' ')}</Badge></Link>)}</div>}
                <PageControls meta={roomsMeta} page={roomsPage} onPageChange={setRoomsPage} />
              </>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-0">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Reservations Ledger</CardTitle><CardDescription className="mt-1">Recent bookings, arrivals, and in-house stays for this property.</CardDescription></div><Button asChild variant="outline" size="sm"><Link href={`/reservations?propertyId=${propertyId}`}>View reservations</Link></Button></div></CardHeader>
            <CardContent className="space-y-4">{reservationsLoading ? <InlineLoading /> : reservations.length === 0 ? <EmptyTab icon={<CalendarDays className="h-5 w-5" />} title="No reservations yet" description="New reservations for this property will appear here." /> : <div className="divide-y rounded-xl border">{reservations.map((reservation: any) => <Link key={reservation.id} href={`/reservations/${reservation.id}`} className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{reservation.primaryGuest ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}` : 'Guest not assigned'}</p><p className="text-xs text-muted-foreground">{reservation.confirmationNumber} · {reservation.reservationRooms?.[0]?.room?.number ? `Room ${reservation.reservationRooms[0].room.number}` : 'Room pending'}</p></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{new Date(reservation.checkIn).toLocaleDateString()}</span><Badge className={`border-0 text-[10px] ${statusClass(reservation.status)}`}>{String(reservation.status).replaceAll('_', ' ')}</Badge></div></Link>)}</div>}<PageControls meta={reservationsMeta} page={reservationsPage} onPageChange={setReservationsPage} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guests" className="mt-0">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Guest Directory</CardTitle><CardDescription className="mt-1">Guests associated with this property.</CardDescription></div><Badge variant="secondary">{guests.length} shown</Badge></div></CardHeader>
            <CardContent className="space-y-4">{guestsLoading ? <InlineLoading /> : guests.length === 0 ? <EmptyTab icon={<Users className="h-5 w-5" />} title="No guests recorded" description="Guest profiles created for this property will appear here." /> : <div className="grid gap-3 sm:grid-cols-2">{guests.map((guest: any) => <div key={guest.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{`${guest.firstName?.[0] || ''}${guest.lastName?.[0] || ''}`}</div><div className="min-w-0"><p className="truncate font-semibold">{guest.firstName} {guest.lastName}</p><p className="truncate text-xs text-muted-foreground">{guest.email || guest.phone || 'No contact details'}</p></div></div>)}</div>}<PageControls meta={guestsMeta} page={guestsPage} onPageChange={setGuestsPage} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-0">
          <Card className="border-muted/60 shadow-sm"><CardHeader><CardTitle>Operational Hub</CardTitle><CardDescription className="mt-1">Live housekeeping and maintenance workload for this property.</CardDescription></CardHeader><CardContent>{housekeepingLoading || maintenanceLoading ? <InlineLoading /> : <div className="grid gap-4 md:grid-cols-2"><Link href={`/housekeeping?propertyId=${propertyId}`} className="rounded-2xl border p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><ClipboardList className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 font-semibold">Housekeeping tasks</p><p className="mt-1 text-3xl font-bold">{housekeepingTasks.length}</p><p className="text-xs text-muted-foreground">Tasks on the current business date</p></Link><Link href={`/maintenance?propertyId=${propertyId}`} className="rounded-2xl border p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Wrench className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 font-semibold">Maintenance tickets</p><p className="mt-1 text-3xl font-bold">{maintenanceTickets.length}</p><p className="text-xs text-muted-foreground">Open work requiring attention</p></Link></div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-0">
          <Card className="border-muted/60 shadow-sm"><CardHeader><div><CardTitle>Financials & Gateway</CardTitle><CardDescription className="mt-1">Current outstanding folios and financial position for this property.</CardDescription></div></CardHeader><CardContent>{receivablesLoading ? <InlineLoading /> : <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-rose-50/50 p-4"><p className="text-xs font-medium text-muted-foreground">Outstanding folios</p><p className="mt-1 text-2xl font-bold text-rose-700">{receivables.length}</p></div><div className="rounded-xl border bg-emerald-50/50 p-4"><p className="text-xs font-medium text-muted-foreground">Total receivables</p><p className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(totalReceivables)}</p></div><div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground">Currency</p><p className="mt-1 text-2xl font-bold">NGN</p></div></div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="buildings" className="mt-0">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Physical Infrastructure</CardTitle>
                  <CardDescription>Buildings, wings, and structural layout.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/buildings`}>
                    Manage Buildings
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {property.buildings.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-xl">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No buildings configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {property.buildings.map((building) => (
                    <Link
                      key={building.id}
                      href={`/buildings/${building.id}`}
                      className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium block group-hover:text-primary transition-colors">{building.name}</span>
                          <span className="text-sm text-muted-foreground block">
                            {building._count?.rooms ?? 0} physical rooms
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transform" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

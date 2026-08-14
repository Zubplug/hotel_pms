'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hotel,
  BedDouble,
  CalendarDays,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/EmptyState';

interface PropertyListItem {
  id: string;
  name: string;
  city: string;
  _count: { rooms: number };
}

interface RoomListItem {
  id: string;
  number: string;
  status: string;
  roomType: { name: string };
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  AVAILABLE:      { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  OCCUPIED:       { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500' },
  RESERVED:       { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },
  DIRTY:          { bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-500' },
  CLEANING:       { bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-500' },
  CLEAN:          { bg: 'bg-teal-50',     text: 'text-teal-700',    dot: 'bg-teal-500' },
  INSPECTED:      { bg: 'bg-cyan-50',     text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  OUT_OF_ORDER:   { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  OUT_OF_SERVICE: { bg: 'bg-gray-50',     text: 'text-gray-700',    dot: 'bg-gray-500' },
  MAINTENANCE:    { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  BLOCKED:        { bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-500' },
};

export default function DashboardPage() {
  const { data: session } = useSession();

  const { data: propertiesData, isLoading: loadingProps } = useQuery({
    queryKey: ['properties', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/v1/properties?pageSize=50');
      if (!res.ok) return { data: [], meta: { total: 0 } };
      return res.json();
    },
  });

  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', 'list', { pageSize: 200 }],
    queryFn: async () => {
      const res = await fetch('/api/v1/rooms?pageSize=200');
      if (!res.ok) return { data: [], meta: { total: 0 } };
      return res.json();
    },
  });

  const properties: PropertyListItem[] = propertiesData?.data ?? [];
  const rooms: RoomListItem[] = roomsData?.data ?? [];

  // Compute room stats by status
  const statusCounts = rooms.reduce<Record<string, number>>((acc, room) => {
    acc[room.status] = (acc[room.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalRooms = rooms.length;
  const availableRooms = statusCounts['AVAILABLE'] ?? 0;
  const occupiedRooms = statusCounts['OCCUPIED'] ?? 0;
  const maintenanceRooms = (statusCounts['OUT_OF_ORDER'] ?? 0) + (statusCounts['MAINTENANCE'] ?? 0);
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = session?.user?.email?.split('@')[0] ?? 'there';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening across your properties today.
        </p>
      </div>

      {/* KPI Cards */}
      {loadingProps || loadingRooms ? (
        <LoadingState message="Loading dashboard..." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-muted/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Properties</p>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Hotel className="h-4.5 w-4.5 text-primary" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{properties.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Active properties</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Total Rooms</p>
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BedDouble className="h-4.5 w-4.5 text-blue-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{totalRooms}</p>
                <p className="text-xs text-muted-foreground mt-1">{availableRooms} available now</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Occupancy</p>
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{occupancyPct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{occupiedRooms} occupied rooms</p>
              </CardContent>
            </Card>

            <Card className="border-muted/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                  <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Wrench className="h-4.5 w-4.5 text-amber-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{maintenanceRooms}</p>
                <p className="text-xs text-muted-foreground mt-1">Rooms out of service</p>
              </CardContent>
            </Card>
          </div>

          {/* Room Status Breakdown + Properties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Room Status Breakdown</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/rooms">
                      View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {totalRooms === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No rooms found.</p>
                ) : (
                  Object.entries(statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => {
                      const colors = statusColors[status] ?? statusColors.AVAILABLE;
                      const pct = Math.round((count / totalRooms) * 100);
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                          <span className="text-sm text-muted-foreground flex-1">
                            {status.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${colors.dot} opacity-70`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-6 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>

            {/* Properties */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Your Properties</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/properties">
                      View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No properties yet.</p>
                ) : (
                  properties.slice(0, 6).map((property) => (
                    <Link
                      key={property.id}
                      href={`/properties/${property.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Hotel className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {property.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{property.city}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{property._count.rooms}</p>
                        <p className="text-xs text-muted-foreground">rooms</p>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/rooms/new">
                  <BedDouble className="mr-2 h-4 w-4" /> Add Room
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/properties/new">
                  <Hotel className="mr-2 h-4 w-4" /> Add Property
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/room-types">
                  <CalendarDays className="mr-2 h-4 w-4" /> Room Types
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

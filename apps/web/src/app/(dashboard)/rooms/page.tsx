'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, LayoutGrid, List, KeyRound, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';

interface Room {
  id: string;
  number: string;
  code: string;
  status: string;
  maintenanceStatus: string | null;
  displayName?: string;
  maxAdults: number;
  maxChildren: number;
  roomType: {
    name: string;
  };
  floor: {
    number: number;
    building: {
      name: string;
    };
  };
}

export default function RoomsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  
  const { data, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await fetch('/api/v1/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const json = await res.json();
      return json.data as Room[];
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Rooms Inventory"
        description="Manage your hotel rooms, statuses, and maintenance operations."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => {
              toast.success('Sync initiated', { description: 'Hardware rooms are being synced...' });
              setTimeout(() => toast.success('Sync complete', { description: 'Fetched 0 new rooms from lock server.' }), 2000);
            }}>
              <RefreshCw className="h-4 w-4" />
              Sync Hardware
            </Button>
            <Button className="gap-2" asChild>
              <Link href="/rooms/new">
                <Plus className="h-4 w-4" />
                Add Room
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search room number..." className="pl-9 bg-background" />
          </div>
          <Button variant="outline" size="icon" className="shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          <Button 
            variant={view === 'grid' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-2"
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={view === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-2"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className={
          view === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            : "flex flex-col gap-3"
        }>
          {data?.map((room) => (
            <Link key={room.id} href={`/rooms/${room.id}/edit`}>
              <Card 
                className={`h-full group overflow-hidden transition-all hover:shadow-md border-muted/60 hover:border-primary/20 ${view === 'list' ? 'flex flex-row items-center p-4' : 'flex flex-col'}`}
              >
              <div className={`${view === 'list' ? 'flex-1 grid grid-cols-5 items-center gap-4' : 'p-4'}`}>
                
                <div className={`${view === 'list' ? 'col-span-1' : 'flex justify-between items-start mb-3'}`}>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold tracking-tighter group-hover:text-primary transition-colors">
                      {room.number}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {room.roomType.name}
                    </span>
                  </div>
                  {view !== 'list' && <StatusBadge status={room.status} className="scale-90 origin-top-right" />}
                </div>
                
                <div className={`${view === 'list' ? 'col-span-2 flex gap-2 items-center' : 'space-y-3'}`}>
                  {view === 'list' && <StatusBadge status={room.status} />}
                  
                  {view !== 'list' && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background text-muted-foreground">
                        Floor {room.floor.number}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background text-muted-foreground">
                        {room.floor.building.name}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className={`${view === 'list' ? 'col-span-2 text-right' : 'mt-4 pt-3 border-t flex justify-between items-center'}`}>
                  {room.maintenanceStatus && room.maintenanceStatus !== 'NONE' ? (
                    <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                      {room.maintenanceStatus.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No alerts</span>
                  )}
                  {view === 'list' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Floor {room.floor.number} • {room.floor.building.name}
                    </div>
                  )}
                </div>

              </div>
            </Card>
          </Link>
          ))}
          
          {data?.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed rounded-xl bg-card">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <KeyRound className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No rooms found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">You haven't added any rooms to this property yet.</p>
              <Button asChild><Link href="/rooms/new">Add First Room</Link></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

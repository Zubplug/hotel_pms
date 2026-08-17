'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import RoomTypeForm from '@/components/admin/RoomTypeForm';
import { Plus, Layers, BedDouble, Users } from 'lucide-react';
import { LoadingState, EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

interface RoomType {
  id: string;
  name: string;
  code: string;
  baseRate: number;
  maxAdults: number;
  maxChildren: number;
  isActive: boolean;
  _count?: { rooms: number };
}

export default function RoomTypesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const res = await fetch('/api/v1/room-types');
      if (!res.ok) throw new Error('Failed to fetch room types');
      return (await res.json()).data as RoomType[];
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Room Types"
        description="Configure room categories, capacities, and base rates."
        actions={
          <Button className="gap-2" asChild>
            <Link href="/room-types/new">
              <Plus className="h-4 w-4" />
              New Room Type
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading room types..." />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="No room types"
          description="Create your first room type to categorize rooms."
          action={<Button asChild><Link href="/room-types/new"><Plus className="mr-2 h-4 w-4" />Create Room Type</Link></Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.map((rt) => (
            <Card key={rt.id} className="group hover:shadow-md transition-all border-muted/60">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-lg group-hover:text-primary transition-colors">{rt.name}</span>
                      {!rt.isActive && (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">{rt.code}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(Number(rt.baseRate))}</p>
                    <p className="text-xs text-muted-foreground">base rate / night</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1.5">
                    <BedDouble className="h-4 w-4" />
                    {rt._count?.rooms ?? 0} rooms
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {rt.maxAdults} adults · {rt.maxChildren} children
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-6 py-3 bg-muted/20 border-t">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/room-types/${rt.id}`}>Manage Type</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

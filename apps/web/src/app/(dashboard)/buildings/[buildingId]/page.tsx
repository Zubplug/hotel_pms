'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { FloorManager } from '@/components/properties/FloorManager';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';

export default function BuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();

  const { data: building, isLoading, isError } = useQuery({
    queryKey: ['buildings', 'detail', buildingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/buildings/${buildingId}`);
      if (!res.ok) throw new Error('Failed to fetch building');
      return (await res.json()).data;
    },
    enabled: !!buildingId,
  });

  const { data: floors } = useQuery({
    queryKey: ['floors', 'building', buildingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/buildings/${buildingId}/floors`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!buildingId,
  });

  if (isLoading) return <LoadingState message="Loading building..." />;
  if (isError || !building) return <ErrorState description="Could not load building details." />;

  // Map API floor data to FloorManager expected shape
  const mappedFloors = (floors ?? []).map((floor: any) => ({
    id: floor.id,
    level: floor.number,
    name: floor.name || `Floor ${floor.number}`,
    rooms: (floor.rooms ?? []).map((room: any) => ({
      id: room.id,
      name: room.number,
      type: room.roomType?.name ?? 'Standard',
      status: room.status,
    })),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={building.name}
        description={`Building code: ${building.code ?? 'N/A'}`}
      />
      <FloorManager
        buildingId={buildingId}
        buildingName={building.name}
        floors={mappedFloors}
      />
    </div>
  );
}

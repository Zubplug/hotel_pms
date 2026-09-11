'use client';


import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomTypeForm } from '@/components/room-types/RoomTypeForm';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/EmptyState';

export default function EditRoomTypePage() {
  const { id } = useParams() as { id: string };

  const { data, isLoading } = useQuery({
    queryKey: ['roomType', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/room-types/${id}`);
      if (!res.ok) throw new Error('Failed to fetch room type');
      return (await res.json()).data;
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Edit Room Type"
        description="Update settings for this room category."
      />
      
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState message="Loading room type..." />
          ) : data ? (
            <RoomTypeForm initialData={data} />
          ) : (
            <div>Room type not found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';


import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomForm } from '@/components/rooms/RoomForm';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/EmptyState';

export default function EditRoomPage() {
  const { roomId } = useParams() as { roomId: string };

  const { data, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/rooms/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch room');
      return (await res.json()).data;
    },
    enabled: !!roomId,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Edit Room"
        description="Update details for this room."
      />
      
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState message="Loading room..." />
          ) : data ? (
            <RoomForm initialData={data} />
          ) : (
            <div>Room not found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

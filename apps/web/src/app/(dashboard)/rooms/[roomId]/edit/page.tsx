'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomForm, RoomFormValues } from '@/components/rooms/RoomForm';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';

export default function EditRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: room, isLoading, isError } = useQuery({
    queryKey: ['rooms', 'detail', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/rooms/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch room');
      return (await res.json()).data;
    },
    enabled: !!roomId,
  });

  async function handleSubmit(data: RoomFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to update room');
      }
      toast.success('Room updated successfully!');
      router.push(`/rooms/${roomId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading room..." />;
  if (isError || !room) return <ErrorState description="Could not load room for editing." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={`Edit Room ${room.number}`}
        description={`${room.roomType?.name ?? ''}`}
      />
      <RoomForm
        mode="edit"
        defaultValues={{
          number: room.number,
          displayName: room.displayName,
          floorId: room.floorId,
          roomTypeId: room.roomTypeId,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

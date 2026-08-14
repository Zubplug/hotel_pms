'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomForm, RoomFormValues } from '@/components/rooms/RoomForm';
import { toast } from 'sonner';

export default function NewRoomPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: RoomFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to create room');
      }
      const json = await res.json();
      toast.success('Room created successfully!');
      router.push(`/rooms/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="New Room"
        description="Add a new room to your property inventory."
      />
      <RoomForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}

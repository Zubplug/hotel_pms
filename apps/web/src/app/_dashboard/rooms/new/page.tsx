'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomForm } from '@/components/rooms/RoomForm';
import { Card, CardContent } from '@/components/ui/card';

export default function NewRoomPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Create Room"
        description="Add a new room to your property."
      />
      
      <Card>
        <CardContent className="pt-6">
          <RoomForm />
        </CardContent>
      </Card>
    </div>
  );
}

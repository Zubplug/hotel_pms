'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomTypeForm } from '@/components/room-types/RoomTypeForm';
import { Card, CardContent } from '@/components/ui/card';

export default function NewRoomTypePage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Create Room Type"
        description="Define a new category of rooms for your property."
      />
      
      <Card>
        <CardContent className="pt-6">
          <RoomTypeForm />
        </CardContent>
      </Card>
    </div>
  );
}

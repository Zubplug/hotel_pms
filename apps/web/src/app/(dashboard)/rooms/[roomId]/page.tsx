'use client';


import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTransitionDialog } from '@/components/rooms/StatusTransitionDialog';
import { LoadingState, ErrorState } from '@/components/ui/EmptyState';
import {
  BedDouble, Users, User, MapPin, Edit, ArrowRightLeft,
  Clock, Layers, Wrench
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface RoomDetail {
  id: string;
  number: string;
  displayName?: string;
  status: string;
  maintenanceStatus?: string;
  maxAdults: number;
  maxChildren: number;
  roomType: { name: string; code: string };
  floor: { number: number; name?: string; building: { name: string } };
}

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);

  const { data: room, isLoading, isError } = useQuery({
    queryKey: ['rooms', 'detail', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/rooms/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch room');
      return (await res.json()).data as RoomDetail;
    },
    enabled: !!roomId,
  });

  if (isLoading) return <LoadingState message="Loading room details..." />;
  if (isError || !room) return <ErrorState description="Could not load room details." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={room.displayName || `Room ${room.number}`}
        description={`${room.roomType.name} · Floor ${room.floor.number} · ${room.floor.building.name}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTransitionDialog(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Change Status
            </Button>
            <Button asChild>
              <Link href={`/rooms/${roomId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Room
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Current Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge status={room.status} />
            {room.maintenanceStatus && room.maintenanceStatus !== 'NONE' && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Wrench className="h-4 w-4" />
                <span>{room.maintenanceStatus.replace(/_/g, ' ')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity Card */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span><strong>{room.maxAdults}</strong> Adults</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span><strong>{room.maxChildren}</strong> Children</span>
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Location</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span>Floor {room.floor.number} {room.floor.name ? `— ${room.floor.name}` : ''}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{room.floor.building.name}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" asChild>
          <Link href={`/rooms/${roomId}/status-history`}>
            <Clock className="h-4 w-4 mr-2" />
            Status History
          </Link>
        </Button>
      </div>

      <StatusTransitionDialog
        isOpen={showTransitionDialog}
        onClose={() => setShowTransitionDialog(false)}
        roomId={roomId}
        currentStatus={room.status}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] })}
      />
    </div>
  );
}

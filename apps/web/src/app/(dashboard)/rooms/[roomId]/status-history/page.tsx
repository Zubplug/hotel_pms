'use client';

export function generateStaticParams() { return []; }

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatusHistoryItem {
  id: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  changedAt: string;
  changedByName?: string;
}

export default function RoomStatusHistoryPage() {
  const { roomId } = useParams<{ roomId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rooms', 'statusHistory', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/rooms/${roomId}/status-history`);
      if (!res.ok) throw new Error('Failed to fetch status history');
      return (await res.json()).data as StatusHistoryItem[];
    },
    enabled: !!roomId,
  });

  if (isLoading) return <LoadingState message="Loading status history..." />;
  if (isError) return <ErrorState description="Could not load status history." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Status History"
        description="A complete log of all status changes for this room."
      />

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="No status history yet"
          description="Status changes will appear here once they occur."
        />
      ) : (
        <div className="relative pl-6 border-l-2 border-muted space-y-0">
          {data.map((item, index) => (
            <div key={item.id} className="relative pb-8">
              {/* Timeline dot */}
              <span className="absolute -left-[1.3125rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background ring-4 ring-background">
                <span className="h-2 w-2 rounded-full bg-primary" />
              </span>

              <Card className="ml-4">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <StatusBadge status={item.previousStatus} />
                    <span className="text-muted-foreground text-sm">→</span>
                    <StatusBadge status={item.newStatus} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {item.changedByName ?? 'System'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.changedAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
                {item.reason && (
                  <div className="px-4 pb-3 text-xs text-muted-foreground italic border-t">
                    Reason: {item.reason}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

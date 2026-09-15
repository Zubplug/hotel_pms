import React from 'react';
import { cn } from '@/lib/utils';

export type EventStatus = 'INQUIRY' | 'TENTATIVE' | 'CONFIRMED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';

interface EventStatusBadgeProps {
  status: EventStatus;
  className?: string;
}

export function EventStatusBadge({ status, className }: EventStatusBadgeProps) {
  const styles: Record<EventStatus, string> = {
    INQUIRY: 'bg-slate-100 text-slate-800 border-slate-200',
    TENTATIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
    IN_SERVICE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    COMPLETED: 'bg-purple-100 text-purple-800 border-purple-200',
    CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <span className={cn('px-2 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full border', styles[status], className)}>
      {status}
    </span>
  );
}

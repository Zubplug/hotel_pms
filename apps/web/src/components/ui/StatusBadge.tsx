import React from 'react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400',
  INACTIVE: 'bg-gray-100 text-gray-800 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-400',
  PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/30 dark:text-yellow-400',
  AVAILABLE: 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400',
  RESERVED: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400',
  OCCUPIED: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400',
  DIRTY: 'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400',
  CLEANING: 'bg-purple-100 text-purple-800 hover:bg-purple-100/80 dark:bg-purple-900/30 dark:text-purple-400',
  CLEAN: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 dark:bg-emerald-900/30 dark:text-emerald-400',
  INSPECTED: 'bg-teal-100 text-teal-800 hover:bg-teal-100/80 dark:bg-teal-900/30 dark:text-teal-400',
  OUT_OF_ORDER: 'bg-rose-100 text-rose-800 hover:bg-rose-100/80 dark:bg-rose-900/30 dark:text-rose-400',
  OUT_OF_SERVICE: 'bg-orange-100 text-orange-800 hover:bg-orange-100/80 dark:bg-orange-900/30 dark:text-orange-400',
  MAINTENANCE: 'bg-amber-100 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400',
  BLOCKED: 'bg-slate-100 text-slate-800 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-400',
};

import { 
  CheckCircle2, 
  CalendarClock, 
  User, 
  Trash2, 
  Brush, 
  Sparkles, 
  Eye, 
  AlertOctagon, 
  Wrench, 
  Ban,
  Activity
} from 'lucide-react';

const statusIcons: Record<string, any> = {
  AVAILABLE: CheckCircle2,
  RESERVED: CalendarClock,
  OCCUPIED: User,
  DIRTY: Trash2,
  CLEANING: Brush,
  CLEAN: Sparkles,
  INSPECTED: Eye,
  OUT_OF_ORDER: AlertOctagon,
  OUT_OF_SERVICE: Wrench,
  MAINTENANCE: Wrench,
  BLOCKED: Ban,
};

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalizedStatus = status?.toUpperCase() || 'UNKNOWN';
  const colorClass = statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  const Icon = statusIcons[normalizedStatus] || Activity;
  
  return (
    <div className={className} {...props}>
      <Badge 
        variant="outline" 
        className={cn('font-medium border-transparent flex items-center gap-1.5', colorClass)} 
      >
        <Icon className="w-3.5 h-3.5" />
        {normalizedStatus.replace(/_/g, ' ')}
      </Badge>
    </div>
  );
}

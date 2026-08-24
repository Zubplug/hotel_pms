'use client';

import React from 'react';
import { WifiOff, CloudSync } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function SyncIndicator() {
  const { isOnline } = useLodgeCoreProvider();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={() => router.push('/frontdesk/sync')}
      className={cn(
        "h-9 px-3 gap-2 rounded-full border shadow-sm transition-colors cursor-pointer",
        isOnline
          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
          : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
      )}
    >
      {isOnline ? <CloudSync className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span className="hidden sm:inline font-medium">Push Queue</span>
    </Button>
  );
}

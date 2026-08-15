'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudSync, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine);

    // Setup listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mock polling for Sync Queue Status (this would be fulfilled by MAUI Interop in prod)
    const pollInterval = setInterval(() => {
      // If we are in the desktop wrapper, we would call window.OfflinePMSInterop.GetSyncStatus()
      if (typeof window !== 'undefined' && (window as any).OfflinePMSInterop) {
        // Mock data for now since we can't await inside setInterval easily without wrapper
        // In real app, fetch from SQLite
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pollInterval);
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Button 
          variant="outline" 
          className={cn(
            "h-9 px-3 gap-2 rounded-full border shadow-sm transition-colors cursor-pointer",
            isOnline 
              ? (conflictCount > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800")
              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
          )}
        >
          {isOnline ? (
            conflictCount > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Sync Conflicts</span>
              </>
            ) : (
              <>
                <CloudSync className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Synced</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Offline Mode</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Sync Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Connection:</span>
            <span className={isOnline ? "text-emerald-600 font-medium" : "text-slate-500 font-medium"}>
              {isOnline ? "Online" : "Disconnected"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending Uploads:</span>
            <span className="font-medium">{pendingCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Conflicts:</span>
            <span className={conflictCount > 0 ? "text-red-600 font-bold" : "font-medium"}>{conflictCount}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/frontdesk/sync')} className="cursor-pointer">
          Open Sync Center
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { toast } from 'sonner';

export function SyncIndicator() {
  const { isOnline, syncStatus, isDesktopMode, provider } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const router = useRouter();
  
  const role = (session?.user as any)?.role;
  const isAuthorized = role === 'ADMIN' || role === 'MANAGER' || role === 'SYSTEM_ADMIN';
  
  // Pending counts could be polled or pushed via IPC
  useEffect(() => {
    if (!isDesktopMode) return;
    
    // Request initial sync counts from IPC
    // (In a real implementation, you would poll or listen to IPC events)
  }, [isDesktopMode]);

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
        <div className="px-3 py-2">
          <Button 
            className="w-full text-xs" 
            size="sm"
            onClick={async () => {
              try {
                if (provider.system?.forceSync) {
                  toast.promise(
                    provider.system.forceSync(),
                    {
                      loading: 'Synchronizing with cloud...',
                      success: 'Sync completed successfully',
                      error: 'Sync failed. Check connection.'
                    }
                  );
                }
              } catch (e) {
                console.error(e);
              }
            }}
          >
            <CloudSync className="mr-2 h-3 w-3" /> Force Sync Now
          </Button>
        </div>

        {isAuthorized && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/frontdesk/sync')} className="cursor-pointer">
              Open Sync Center
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

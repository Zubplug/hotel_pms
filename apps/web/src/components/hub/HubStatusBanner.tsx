'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, HardDrive, Cloud, CalendarDays, LogOut } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useLogout } from '@/hooks/useLogout';

interface HubStatusBannerProps {
  user: { name?: string | null; role?: string; propertyId?: string };
  businessDate: string;
}

export function HubStatusBanner({ user, businessDate }: HubStatusBannerProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState(0);
  const logout = useLogout();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if running inside WebView2 Desktop App
    if (typeof window !== 'undefined' && (window as any).LodgeCore) {
      setIsDesktop(true);
      
      const pollSyncStatus = async () => {
        try {
          if ((window as any).chrome?.webview) {
            (window as any).chrome.webview.postMessage({ command: 'GetSyncStatus' });
          }
        } catch (e) {
          console.error('Failed to get sync status from IPC', e);
        }
      };

      const handleMessage = (event: any) => {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'sync.status') {
          setSyncQueue(data.pendingCount || 0);
        }
      };

      if ((window as any).chrome?.webview) {
        (window as any).chrome.webview.addEventListener('message', handleMessage);
        pollSyncStatus();
        const intervalId = setInterval(pollSyncStatus, 5000); // Poll every 5s

        return () => {
          clearInterval(intervalId);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          (window as any).chrome.webview.removeEventListener('message', handleMessage);
        };
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="bg-[#081426] border-b border-white/[0.08] px-4 py-3 shadow-[0_8px_30px_rgba(2,8,23,0.18)] sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black tracking-tight text-cyan-200">LC</div>
        <h1 className="text-base font-bold tracking-[0.18em] text-white sm:text-xl">LODGECORE</h1>
        <div className="h-4 w-px bg-slate-600"></div>
        <span className="truncate text-xs text-slate-300 sm:text-sm">
          {user.name || 'User'} • {user.role || 'Staff'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300 sm:gap-3 lg:justify-end">
        {isDesktop && (
          <div
            role="status"
            aria-live="polite"
            title={isOnline ? 'Connected to LodgeCore online services' : 'Offline mode: changes will be queued for synchronization'}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide ${
              isOnline
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-rose-400/25 bg-rose-400/10 text-rose-300'
            }`}
          >
            {isOnline ? (
              <><Wifi className="w-4 h-4" aria-hidden="true" /> <span>ONLINE</span></>
            ) : (
              <><WifiOff className="w-4 h-4" aria-hidden="true" /> <span>OFFLINE</span></>
            )}
          </div>
        )}

        {isDesktop ? (
          <>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Offline Ready</span>
            </div>
            {!isOnline && (
              <div className="flex flex-col text-xs leading-tight">
                <span>Sync Queue: {syncQueue} pending</span>
                <span className="text-slate-400">Transactions will sync when online.</span>
              </div>
            )}
          </>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold text-cyan-200">
            <Cloud className="h-4 w-4" aria-hidden="true" />
            <span>Cloud Connected</span>
          </div>
        )}

        <div className="hidden h-5 w-px bg-white/10 sm:block"></div>
        
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>Business Date</span>
          <span className="font-semibold text-white">{businessDate}</span>
        </div>

        <button 
          onClick={() => logout()}
          aria-label="Logout"
          title="Logout"
          className="ml-0 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-slate-300 transition-colors hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-xs font-semibold sm:inline">Logout</span>
        </button>
      </div>
      </div>
    </div>
  );
}

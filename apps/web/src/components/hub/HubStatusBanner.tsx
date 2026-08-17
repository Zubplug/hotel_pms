'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, HardDrive, Bell, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface HubStatusBannerProps {
  user: { name?: string | null; role?: string; propertyId?: string };
  businessDate: string;
}

export function HubStatusBanner({ user, businessDate }: HubStatusBannerProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState(0);

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
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-white tracking-wide">LODGECORE</h1>
        <div className="h-4 w-px bg-slate-600"></div>
        <span className="text-slate-300 text-sm">
          {user.name || 'User'} • {user.role || 'Staff'}
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <><Wifi className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-400">ONLINE</span></>
          ) : (
            <><WifiOff className="w-4 h-4 text-rose-400" /> <span className="text-rose-400">OFFLINE</span></>
          )}
        </div>

        {isDesktop ? (
          <>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Offline Ready</span>
            </div>
            <div className="flex flex-col text-xs leading-tight">
              <span>Sync Queue: {syncQueue} pending</span>
              {!isOnline && <span className="text-slate-400">Transactions will sync when online.</span>}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <span>Cloud Connected</span>
          </div>
        )}

        <div className="h-4 w-px bg-slate-600"></div>
        
        <div className="flex items-center gap-2 font-medium">
          Business Date: <span className="text-white">{businessDate}</span>
        </div>

        {user.role !== 'RECEPTIONIST' && user.role !== 'CASHIER' && (
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { LodgeCoreDataProvider } from './DataProvider';
import { OnlineDataProvider } from './OnlineDataProvider';
import { DesktopDataProvider } from './DesktopDataProvider';

interface DataProviderContextValue {
  provider: LodgeCoreDataProvider;
  isDesktopMode: boolean;
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  pos: LodgeCoreDataProvider['pos'];
}

const DataProviderContext = createContext<DataProviderContextValue>({
  provider: OnlineDataProvider,
  isDesktopMode: false,
  isOnline: true,
  syncStatus: 'synced',
  pos: {
    getProducts: async () => ({ data: [], error: 'Not initialized' }),
    getCategories: async () => ({ data: [], error: 'Not initialized' }),
    getActiveStaff: async () => ({ data: [], error: 'Not initialized' }),
    getCurrentOperator: async () => ({ data: null, error: 'Not initialized' }),
    authenticateOperator: async () => ({ data: null, error: 'Not initialized' }),
    startSession: async () => ({ data: null, error: 'Not initialized' }),
    getAuthorizedOutlets: async () => ({ data: null, error: 'Not initialized' }),
  } as any // Type assertion used to stub the POS interface prior to provider initialization
});

export function DataProviderWrapper({ children }: { children: React.ReactNode }) {
  const [isDesktopMode, setIsDesktopMode] = useState(process.env.NEXT_PUBLIC_IS_DESKTOP === "true");
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  useEffect(() => {
    // Check if we are running inside the MAUI WebView2 container
    const isRunningInDesktop = typeof window !== 'undefined' && !!(window as any).chrome?.webview;
    // Or if we were compiled explicitly for desktop
    const isCompiledForDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";
    
    setIsDesktopMode(isRunningInDesktop || isCompiledForDesktop);

    if (isRunningInDesktop) {
      // Listen for network changes
      const handleOnline = () => {
        setIsOnline(true);
        setSyncStatus('syncing');
        // Trigger a sync check with the desktop bridge here if needed
      };
      const handleOffline = () => {
        setIsOnline(false);
        setSyncStatus('offline');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsOnline(navigator.onLine);

      // Listen for sync status events from C# MAUI
      const handleMessage = (event: any) => {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'sync.status_changed') {
          setSyncStatus(data.status);
        }
      };
      (window as any).chrome.webview.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if ((window as any).chrome?.webview) {
          (window as any).chrome.webview.removeEventListener('message', handleMessage);
        }
      };
    }
  }, []);

  const provider = (isDesktopMode ? DesktopDataProvider : OnlineDataProvider) as unknown as LodgeCoreDataProvider;

  return (
    <DataProviderContext.Provider value={{ provider, isDesktopMode, isOnline, syncStatus, pos: provider.pos as any }}>
      {children}
    </DataProviderContext.Provider>
  );
}

export function useLodgeCoreProvider() {
  return useContext(DataProviderContext);
}

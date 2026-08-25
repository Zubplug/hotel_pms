'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface AutoLockScreenProps {
  children: React.ReactNode;
  onLock: () => void;
  isLocked: boolean;
}

export function AutoLockScreen({ children, onLock, isLocked }: AutoLockScreenProps) {
  const { data: session } = useLodgeCoreSession();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  
  // Default to 60 seconds for restaurant, can be read from session/outlet config
  const autoLockSeconds = (session as any)?.autoLockSeconds || 60;

  useEffect(() => {
    if (isLocked) return;

    let timeout: NodeJS.Timeout;
    
    const lock = () => {
      onLock();
    };

    const reset = () => {
      clearTimeout(timeout);
      timeout = setTimeout(lock, autoLockSeconds * 1000);
    };

    // Initial set
    reset();

    const keepAlive = isDesktopMode && provider.pos.keepAlive
      ? window.setInterval(() => {
          void provider.pos.keepAlive();
        }, Math.max(10000, autoLockSeconds * 500))
      : undefined;

    // Listeners for user activity
    window.addEventListener('mousemove', reset);
    window.addEventListener('mousedown', reset);
    window.addEventListener('keypress', reset);
    window.addEventListener('touchstart', reset);

    return () => {
      clearTimeout(timeout);
      if (keepAlive) window.clearInterval(keepAlive);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('mousedown', reset);
      window.removeEventListener('keypress', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, [isLocked, autoLockSeconds, onLock, isDesktopMode, provider]);

  return <>{children}</>;
}

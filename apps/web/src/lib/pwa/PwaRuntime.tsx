'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { isPwaEligiblePath } from './route-policy';

/** Registers the online PWA only; the MAUI WebView owns desktop offline behavior. */
export function PwaRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if ((window as Window & { chrome?: { webview?: unknown } }).chrome?.webview) return;
    if (!window.isSecureContext || !isPwaEligiblePath(pathname || window.location.pathname)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let removeVisibilityListener: (() => void) | undefined;

    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((value) => {
        registration = value;
        if (disposed) return;
        const updateOnVisibility = () => {
          if (document.visibilityState === 'visible') void registration?.update();
        };
        document.addEventListener('visibilitychange', updateOnVisibility);
        removeVisibilityListener = () => document.removeEventListener('visibilitychange', updateOnVisibility);
      })
      .catch((error) => {
        // PWA is an enhancement; registration failure must not block the app.
        console.warn('[LodgeCore PWA] Service worker registration failed.', error);
      });

    return () => {
      disposed = true;
      removeVisibilityListener?.();
    };
  }, [pathname]);

  return null;
}

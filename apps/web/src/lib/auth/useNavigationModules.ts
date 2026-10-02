'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import {
  readOfflineNavigationSnapshot,
  writeOfflineNavigationSnapshot,
} from './offline-navigation-snapshot';
import { NAVIGATION_MODULES, type NavigationModule } from './navigation-modules';

export function useNavigationModules(propertyId?: string | null) {
  const { provider, isDesktopMode, isOnline } = useLodgeCoreProvider();
  const compiledDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';
  const runtimeDesktop = typeof window !== 'undefined'
    && Boolean((window as Window & { chrome?: { webview?: unknown } }).chrome?.webview);
  const desktopMode = compiledDesktop || isDesktopMode || runtimeDesktop;
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine;
  const propertyKey = propertyId ?? 'default';
  const [desktopModules, setDesktopModules] = useState<{
    propertyKey: string;
    modules: NavigationModule[];
  } | null>(null);

  useEffect(() => {
    if (!desktopMode) return;

    let cancelled = false;
    const request = provider.system?.getTerminalStatus?.();
    if (request) {
      void request.then((terminal: unknown) => {
        const localTerminal = terminal as {
          enabledModules?: unknown;
          licenseState?: unknown;
          licenseExpiresAt?: string | null;
          entitlementsCapturedAt?: string | null;
        } | null;
        if (cancelled || !Array.isArray(localTerminal?.enabledModules)) return;
        const modules = localTerminal.enabledModules.filter((module: unknown): module is NavigationModule =>
          typeof module === 'string' && NAVIGATION_MODULES.includes(module as NavigationModule),
        );
        setDesktopModules({ propertyKey, modules });
        const licenseState = String(localTerminal?.licenseState ?? '').toUpperCase();
        writeOfflineNavigationSnapshot(modules, propertyId, {
          status: licenseState === 'REVOKED' ? 'REVOKED' : licenseState === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
          expiresAt: localTerminal?.licenseExpiresAt ?? null,
          capturedAt: localTerminal?.entitlementsCapturedAt ?? new Date().toISOString(),
        });
      }).catch(() => {
        // The last local snapshot remains authoritative while offline.
      });
    }
    return () => { cancelled = true; };
  }, [desktopMode, propertyId, propertyKey, provider]);

  const query = useQuery<NavigationModule[]>({
    queryKey: ['navigation-modules', propertyId ?? 'default'],
    queryFn: async () => {
      const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
      const response = await fetch(`/api/v1/navigation/modules${query}`);
      if (!response.ok) throw new Error('Unable to resolve module access');
      const payload = await response.json() as {
        modules: NavigationModule[];
        status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'RESTRICTED' | 'UNKNOWN';
        expiresAt?: string | null;
        capturedAt?: string;
      };
      const modules = payload.modules;
      writeOfflineNavigationSnapshot(modules, propertyId, {
        status: payload.status ?? (modules.length ? 'ACTIVE' : 'UNKNOWN'),
        expiresAt: payload.expiresAt ?? null,
        capturedAt: payload.capturedAt ?? new Date().toISOString(),
      });
      return modules;
    },
    // A desktop build uses its local entitlement/license state. It must never
    // wait for or fail because the cloud navigation endpoint is unavailable.
    enabled: !desktopMode && isOnline && browserOnline,
    staleTime: 60_000,
  });

  return {
    ...query,
    data: query.data
      ?? (desktopModules?.propertyKey === propertyKey
        ? desktopModules.modules
        : readOfflineNavigationSnapshot(propertyId)),
  };
}

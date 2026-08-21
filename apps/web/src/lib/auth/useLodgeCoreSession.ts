'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

const IS_DESKTOP = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

/**
 * Returns the active session regardless of whether we are in Desktop (WebView2/C#) or Web (NextAuth) mode.
 *
 * On desktop:
 *   - NextAuth's useSession is NEVER called — it would attempt to fetch /api/auth/session
 *     which does not exist in the static MSIX bundle, causing React hydration error #418.
 *   - Instead, the session is read via the IPC bridge from the C# SessionManager.
 *
 * On web:
 *   - Standard NextAuth useSession is returned as-is.
 */
export function useLodgeCoreSession() {
  // On web we call useSession unconditionally (hooks must not be conditional)
  // but we ignore its return value on desktop.
  const nextAuthSession = useSession();
  const { provider } = useLodgeCoreProvider();

  const { data: desktopSession, isLoading } = useQuery({
    queryKey: ['desktop_auth'],
    queryFn: async () => {
      const res = await provider.auth.getSession();
      return typeof res === 'string' ? JSON.parse(res) : res;
    },
    // Only run on desktop — avoids the /api/auth/session 404 in WebView2
    enabled: IS_DESKTOP,
    // Don't retry — if the bridge isn't ready, we show unauthenticated
    retry: false,
    staleTime: 30_000,
  });

  if (IS_DESKTOP) {
    if (isLoading) {
      return { data: null, status: 'loading' as const };
    }
    if (!desktopSession?.userId) {
      return { data: null, status: 'unauthenticated' as const };
    }
    return {
      data: {
        user: {
          id: desktopSession.userId,
          name: desktopSession.displayName ?? desktopSession.userId,
          email: desktopSession.email ?? `${desktopSession.userId}@desktop.local`,
          role: desktopSession.role,
          staffId: desktopSession.staffId,
          propertyId: desktopSession.propertyId,
        },
        sessionId: desktopSession.sessionId,
        expires: desktopSession.expiresAt ?? '',
      },
      status: 'authenticated' as const,
    };
  }

  return nextAuthSession;
}


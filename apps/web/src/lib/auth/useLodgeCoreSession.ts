'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function useLodgeCoreSession() {
  const nextAuthSession = useSession();
  const { provider } = useLodgeCoreProvider();
  const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

  const { data: desktopSession, isLoading } = useQuery({
    queryKey: ['desktop_auth'],
    queryFn: async () => {
      const res = await provider.auth.getSession();
      return res;
    },
    enabled: isDesktop,
  });

  if (isDesktop) {
    if (isLoading) {
      return { data: null, status: 'loading' };
    }
    if (!desktopSession || !desktopSession.userId) {
      return { data: null, status: 'unauthenticated' };
    }
    return {
      data: {
        user: {
          id: desktopSession.userId,
          name: desktopSession.userId, // Map as needed
          email: desktopSession.userId + '@desktop.local',
          role: desktopSession.role,
        },
        expires: desktopSession.expiresAt,
      },
      status: 'authenticated',
    };
  }

  return nextAuthSession;
}

import { useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

/**
 * Canonical logout operation for LodgeCore.
 * Internally performs:
 * 1. Desktop session cleanup (SecureStorage AUTH_TOKEN removed)
 * 2. Web session cleanup (NextAuth cookie cleared)
 * 
 * Ensures that clicking 'Logout' on the desktop app actually clears 
 * the underlying C# wrapper authentication state in addition to the web session.
 */
export function useLogout() {
  const { provider } = useLodgeCoreProvider();

  const handleLogout = useCallback(async () => {
    try {
      // 1. Clear Desktop authentication (SecureStorage operator token)
      // This is idempotent: if there is no desktop token, it simply succeeds.
      // It intentionally DOES NOT close the POS financial session.
      if (provider.auth?.logout) {
        await provider.auth.logout().catch(err => {
          console.warn('[Desktop Logout] Failed to clear desktop session', err);
        });
      }
    } catch (error) {
      console.warn('[Desktop Logout] Error during logout', error);
    } finally {
      // 2. Clear Web session (NextAuth) and redirect to login
      await signOut({ callbackUrl: '/login' });
    }
  }, [provider]);

  return handleLogout;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLodgeCore } from '@/lib/auth/useLodgeCoreSession';

export default function DesktopAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { provider } = useLodgeCore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        // C# is authoritative over whether the session is valid
        const responseString = await provider.auth.getSession();
        if (typeof responseString === 'string') {
          const res = JSON.parse(responseString);
          if (res.success && res.data?.authenticated) {
            setIsAuthenticated(true);
          } else {
            router.push('/desktop');
          }
        } else {
            // Online data provider typically returns objects, but in Desktop mode it should be a string from IPC.
            // Adjust logic if needed for DesktopDataProvider specifics.
            const res = responseString as any;
            if (res.success && res.data?.authenticated) {
              setIsAuthenticated(true);
            } else {
              router.push('/desktop');
            }
        }
      } catch (e) {
        console.error('Desktop Auth check failed:', e);
        router.push('/desktop');
      } finally {
        setIsChecking(false);
      }
    }
    checkAuth();
  }, [provider, router]);

  if (isChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
          <p className="text-slate-500 font-medium">Validating local session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null; // Will redirect

  return <>{children}</>;
}

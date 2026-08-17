'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

import { PropertyProvider } from './PropertyProvider';
import { DataProviderWrapper } from '@/lib/desktop/DataProviderContext';
import { LockProvider } from '@/components/auth/LockProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";

  return (
    <SessionProvider session={isDesktop ? null : undefined}>
      <QueryClientProvider client={queryClient}>
        <DataProviderWrapper>
          <LockProvider>
            <PropertyProvider>
              {children}
            </PropertyProvider>
          </LockProvider>
        </DataProviderWrapper>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}

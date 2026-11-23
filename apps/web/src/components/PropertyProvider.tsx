'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface PropertyContextType {
  propertyId: string;
  setPropertyId: (id: string) => void;
  isLoading: boolean;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [propertyId, setPropertyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { status: sessionStatus } = useLodgeCoreSession();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const pathname = usePathname();

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      return;
    }

    // External auditors use their authorized engagement scope, not the
    // organization property directory. Avoid the organization-only endpoint.
    if (pathname?.startsWith('/external-auditor')) {
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem('selectedPropertyId');

    // Resolve the selection from the live authorized property list. A stored
    // browser value is only accepted when it is still in the user's scope.
    async function autoSelectProperty() {
      const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
      const readProperties = async () => {
        const result = await provider.properties.list();
        const list: { id: string }[] =
          Array.isArray(result?.data?.data)
            ? result.data.data
            : Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result)
            ? result
            : [];
        return list;
      };

      try {
        let list = await readProperties();

        // A newly provisioned desktop has its terminal identity immediately,
        // while the full property row is hydrated by the first sync. Wake the
        // sync engine and retry the local projection instead of leaving the
        // authenticated operator on an empty “No Property Selected” screen.
        if (isDesktopMode && list.length === 0) {
          const terminal = await provider.system?.getTerminalStatus?.();
          const terminalPropertyId = terminal?.propertyId || terminal?.data?.propertyId;
          if (terminalPropertyId) {
            setPropertyId(terminalPropertyId);
            localStorage.setItem('selectedPropertyId', terminalPropertyId);
          }
          await provider.system?.forceSync?.();
          for (const delay of [250, 750, 1500]) {
            await sleep(delay);
            list = await readProperties();
            if (list.length > 0) break;
          }
        }

        if (list.length > 0) {
          const resolvedId = stored && list.some((property) => property.id === stored)
            ? stored
            : list[0].id;
          setPropertyId(resolvedId);
          localStorage.setItem('selectedPropertyId', resolvedId);
        }
      } catch {
        // Silently fail — user can still pick manually from the dropdown
      } finally {
        setIsLoading(false);
      }
    }

    autoSelectProperty();
  }, [isDesktopMode, provider, sessionStatus, pathname]);

  const handleSetPropertyId = (id: string) => {
    setPropertyId(id);
    localStorage.setItem('selectedPropertyId', id);
  };

  return (
    <PropertyContext.Provider value={{ propertyId, setPropertyId: handleSetPropertyId, isLoading }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}

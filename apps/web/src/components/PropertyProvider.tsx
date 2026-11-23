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

    // On desktop, the provisioned terminal property is authoritative. Never
    // select an arbitrary first row when a terminal is bound to one property.
    async function autoSelectProperty() {
      const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
      const readTerminalPropertyId = async () => {
        if (!isDesktopMode) return '';
        const terminal = await provider.system?.getTerminalStatus?.();
        return terminal?.propertyId || terminal?.data?.propertyId || '';
      };
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
        const terminalPropertyId = await readTerminalPropertyId();
        let list = await readProperties();

        // The first-run setup gate normally guarantees this row exists. The
        // short retry handles the WebView/SQLite startup race after setup.
        for (const delay of [0, 250, 750, 1500]) {
          if (delay > 0) await sleep(delay);
          if (delay > 0) list = await readProperties();

          if (terminalPropertyId) {
            const terminalProperty = list.find((property) => property.id === terminalPropertyId);
            if (terminalProperty) {
              setPropertyId(terminalProperty.id);
              localStorage.setItem('selectedPropertyId', terminalProperty.id);
              return;
            }
          } else if (list.length > 0) {
            const resolvedId = stored && list.some((property) => property.id === stored) ? stored : list[0].id;
            setPropertyId(resolvedId);
            localStorage.setItem('selectedPropertyId', resolvedId);
            return;
          }
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

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

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
      try {
        const res = await fetch('/api/v1/properties?pageSize=100', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Property scope request failed (${res.status})`);
        const json = await res.json();
        // Support both { data: [...] } and paginated { data: { data: [...] } } shapes
        const list: { id: string }[] =
          Array.isArray(json?.data?.data)
            ? json.data.data
            : Array.isArray(json?.data)
            ? json.data
            : [];
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
  }, [sessionStatus, pathname]);

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

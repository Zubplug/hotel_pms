'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PropertyContextType {
  propertyId: string;
  setPropertyId: (id: string) => void;
  isLoading: boolean;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [propertyId, setPropertyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. If we already have a stored selection, use it immediately
    const stored = localStorage.getItem('selectedPropertyId');
    if (stored) {
      setPropertyId(stored);
      setIsLoading(false);
      return;
    }

    // 2. Nothing stored — auto-select the first property the user has access to
    //    This handles first-login scenarios (e.g. Night Auditor, Receptionist)
    async function autoSelectProperty() {
      try {
        const res = await fetch('/api/v1/properties?pageSize=1');
        if (!res.ok) return;
        const json = await res.json();
        // Support both { data: [...] } and paginated { data: { data: [...] } } shapes
        const list: { id: string }[] =
          Array.isArray(json?.data?.data)
            ? json.data.data
            : Array.isArray(json?.data)
            ? json.data
            : [];
        if (list.length > 0) {
          const firstId = list[0].id;
          setPropertyId(firstId);
          localStorage.setItem('selectedPropertyId', firstId);
        }
      } catch {
        // Silently fail — user can still pick manually from the dropdown
      } finally {
        setIsLoading(false);
      }
    }

    autoSelectProperty();
  }, []);

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

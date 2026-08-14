'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PropertyContextType {
  propertyId: string;
  setPropertyId: (id: string) => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [propertyId, setPropertyId] = useState<string>('');

  useEffect(() => {
    // Optionally load from localStorage or set a default if needed
    const stored = localStorage.getItem('selectedPropertyId');
    if (stored) setPropertyId(stored);
  }, []);

  const handleSetPropertyId = (id: string) => {
    setPropertyId(id);
    localStorage.setItem('selectedPropertyId', id);
  };

  return (
    <PropertyContext.Provider value={{ propertyId, setPropertyId: handleSetPropertyId }}>
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

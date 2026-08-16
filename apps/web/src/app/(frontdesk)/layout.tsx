import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';
import React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FrontDeskLayout>
      {children}
    </FrontDeskLayout>
  );
}

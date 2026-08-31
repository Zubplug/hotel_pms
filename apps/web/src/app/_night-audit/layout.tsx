import { NightAuditLayout } from '@/components/layout/NightAuditLayout';
import React from 'react';

export default function NightAuditRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <NightAuditLayout>
      {children}
    </NightAuditLayout>
  );
}

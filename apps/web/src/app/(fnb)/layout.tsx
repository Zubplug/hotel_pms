import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function FnbLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}

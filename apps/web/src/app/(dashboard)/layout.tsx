import { DashboardLayout } from '@/components/layout/DashboardLayout';
import React from 'react';
import { auth } from '@/lib/auth';
import { getNavigationModules } from '@/lib/auth/navigation-entitlements';

export default async function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const navigationModules = session?.user
    ? await getNavigationModules(session.user.id, (session.user as any).propertyId)
    : [];
  return (
    <DashboardLayout enabledModules={navigationModules}>
      {children}
    </DashboardLayout>
  );
}

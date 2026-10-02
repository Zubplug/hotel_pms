import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';
import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { getNavigationModules } from '@/lib/auth/navigation-entitlements';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'MODULE_PMS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=MODULE_PMS');
  }
  const navigationModules = await getNavigationModules(session.user.id, session.user.propertyId);
  return (
    <FrontDeskLayout enabledModules={navigationModules}>
      {children}
    </FrontDeskLayout>
  );
}

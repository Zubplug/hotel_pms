import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';
import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'CORE_PMS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=CORE_PMS');
  }
  return (
    <FrontDeskLayout>
      {children}
    </FrontDeskLayout>
  );
}

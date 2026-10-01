import React from 'react';
import { FnbLayout } from '@/components/layout/FnbLayout';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

export default async function FnbLayoutWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'PROFESSIONAL_OPERATIONS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=PROFESSIONAL_OPERATIONS');
  }
  return (
    <FnbLayout>
      {children}
    </FnbLayout>
  );
}

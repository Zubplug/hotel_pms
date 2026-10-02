import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';
import { CashManagementLayout } from '@/components/layout/CashManagementLayout';
import { requireModuleAccess } from '@/lib/auth/module-access';

const ALLOWED = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HOTEL_MANAGER', 'NIGHT_AUDITOR'];

export default async function CashierRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  
  if (!session?.user || (!isSuperAdmin && !ALLOWED.includes(role))) {
    redirect('/general-manager');
  }
  try {
    await requireModuleAccess(session.user.id, 'MODULE_PMS', (session.user as any).propertyId);
  } catch {
    redirect('/settings/billing?required=MODULE_PMS');
  }

  return (
    <CashManagementLayout>
      {children}
    </CashManagementLayout>
  );
}

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';
import { CashManagementLayout } from '@/components/layout/CashManagementLayout';

const ALLOWED = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HOTEL_MANAGER'];

export default async function CashierRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  
  if (!session?.user || (!isSuperAdmin && !ALLOWED.includes(role))) {
    redirect('/dashboard');
  }

  return (
    <CashManagementLayout>
      {children}
    </CashManagementLayout>
  );
}

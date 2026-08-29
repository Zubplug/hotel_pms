import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';
import { InventoryLayout } from '@/components/layout/InventoryLayout';

// General Cashiers may access the cost-control views linked from Cash Management.
// Actions on those pages remain protected by their individual role checks.
const ALLOWED = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'GENERAL_CASHIER', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER'];

export default async function InventoryRootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = String((session?.user as any)?.role || '').toUpperCase();
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  
  // Enforce server-side authorization
  if (!session?.user || (!isSuperAdmin && !ALLOWED.includes(role))) {
    redirect('/dashboard');
  }

  return (
    <InventoryLayout>
      {children}
    </InventoryLayout>
  );
}

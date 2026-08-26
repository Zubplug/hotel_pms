import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';

const ALLOWED = ['CEO','SUPER_ADMIN','MANAGER','STOCK_MANAGER','PROCUREMENT_MANAGER'];

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  if (!session?.user || (!isSuperAdmin && !ALLOWED.includes(role))) redirect('/dashboard');
  return <>{children}</>;
}

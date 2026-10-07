import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { KitchenLayout } from '@/components/layout/KitchenLayout';

export default async function KitchenRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  try {
    await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=MODULE_OPERATIONS');
  }

  const role = String((session.user as any).role || '').toUpperCase();
  const capabilities = Array.isArray((session.user as any).capabilities)
    ? (session.user as any).capabilities as string[]
    : [];
  const managementRoles = ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'ADMIN', 'ACCOUNTANT', 'DIRECTOR'];
  const kitchenRoles = ['KITCHEN_STAFF', 'CHEF', 'HEAD_CHEF', 'KITCHEN_MANAGER'];
  const canAccess = (session.user as any).isLodgeCoreAdmin || managementRoles.includes(role) ||
    kitchenRoles.includes(role) || capabilities.includes('ACCESS_KITCHEN') ||
    capabilities.some((value) => value.startsWith('kitchen.'));

  if (!canAccess) redirect('/hub');
  return <KitchenLayout>{children}</KitchenLayout>;
}

import React from 'react';
import { FnbLayout } from '@/components/layout/FnbLayout';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { hasFoodCommercePlanAccess, hasPublicCommerceAccess } from '@/lib/commerce/public-access';

export default async function FnbLayoutWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  let organizationId: string;
  try {
    const ctx = await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
    organizationId = ctx.organizationId;
  } catch {
    redirect(`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://lodgecore.zubplug.com.ng'}/portal/subscription?required=MODULE_OPERATIONS`);
  }

  const propertyId = session.user.propertyId;
  const commerceEnabled = Boolean(propertyId)
    && await hasPublicCommerceAccess(organizationId, propertyId)
    && await hasFoodCommercePlanAccess(organizationId, propertyId);

  return (
    <FnbLayout showFoodCommerce={commerceEnabled}>
      {children}
    </FnbLayout>
  );
}

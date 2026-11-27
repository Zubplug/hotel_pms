import React from 'react';
import { CommerceLayout } from '@/components/layout/CommerceLayout';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { requireOrganizationContext } from '@/lib/organization-access';

/**
 * This route is deliberately outside the hotel F&B module group. Standalone
 * Food Commerce customers need authentication and the Commerce add-on, but
 * do not need a Professional PMS plan or access to the wider F&B workspace.
 */
export default async function FoodCommerceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const ctx = await requireOrganizationContext(session.user.id);

  try {
    await requireFoodCommerceEntitlement(ctx.organizationId, session.user.propertyId);
  } catch {
    redirect(
      `${process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://lodgecore.zubplug.com.ng'}/portal/subscription?required=FOOD_COMMERCE`,
    );
  }

  return <CommerceLayout>{children}</CommerceLayout>;
}

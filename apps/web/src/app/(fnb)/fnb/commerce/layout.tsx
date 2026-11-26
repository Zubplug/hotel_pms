import React from 'react';
import { CommerceLayout } from '@/components/layout/CommerceLayout';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { requireOrganizationContext } from '@/lib/organization-access';

export default async function CommerceDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const ctx = await requireOrganizationContext(session.user.id);

  try {
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
  } catch {
    // Redirect to portal subscription page — same pattern as (fnb)/layout.tsx
    redirect(
      `${process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://lodgecore.zubplug.com.ng'}/portal/subscription?required=ADDON_FOOD_COMMERCE`,
    );
  }

  return <CommerceLayout>{children}</CommerceLayout>;
}

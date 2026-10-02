import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';
import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { getNavigationLicenseSnapshot } from '@/lib/auth/navigation-entitlements';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The desktop build is a static export. Authentication, property scope and
  // billing are resolved by the native/local provider there; calling
  // NextAuth/Prisma during static export would make the offline shell depend
  // on the cloud. The client workspace still filters optional navigation from
  // its locally cached entitlement snapshot.
  if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') {
    return <FrontDeskLayout enabledModules={[]}>{children}</FrontDeskLayout>;
  }

  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'MODULE_PMS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=MODULE_PMS');
  }
  const navigationLicense = await getNavigationLicenseSnapshot(session.user.id, session.user.propertyId);
  return (
    <FrontDeskLayout enabledModules={navigationLicense.modules} licenseSnapshot={navigationLicense}>
      {children}
    </FrontDeskLayout>
  );
}

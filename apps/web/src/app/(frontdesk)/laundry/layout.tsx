import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

/** Laundry is an operational department, not a Starter/PMS capability. */
export default async function LaundryLayout({ children }: { children: React.ReactNode }) {
  // The desktop bundle is a static export. The native/local session and
  // entitlement guard handle access there; calling NextAuth during export
  // makes this otherwise client-driven workspace depend on request headers.
  if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') return children;

  const session = await auth();
  if (!session?.user) redirect('/login');

  try {
    await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
  } catch {
    redirect(`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app'}/portal/subscription?required=MODULE_OPERATIONS`);
  }

  return children;
}

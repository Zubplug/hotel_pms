import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { HrLayout } from '@/components/layout/HrLayout';
import { EmployeeSelfServiceLayout } from '@/components/layout/EmployeeSelfServiceLayout';
import { getNavigationModules } from '@/lib/auth/navigation-entitlements';

export const metadata = {
  title: 'HR & Payroll Management | LodgeCore',
  description: 'Enterprise Human Resources, Time & Attendance, and Statutory Payroll for LodgeCore',
};

export default async function HrRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if ((session.user as any).selfServiceOnly) {
    return <EmployeeSelfServiceLayout>{children}</EmployeeSelfServiceLayout>;
  }

  const navigationModules = await getNavigationModules(
    session.user.id,
    (session.user as any).propertyId
  );

  return (
    <HrLayout enabledModules={navigationModules}>
      {children}
    </HrLayout>
  );
}

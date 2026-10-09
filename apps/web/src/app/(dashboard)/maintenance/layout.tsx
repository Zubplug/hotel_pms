import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
  } catch {
    redirect(`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app'}/portal/subscription?required=MODULE_OPERATIONS`);
  }
  return children;
}

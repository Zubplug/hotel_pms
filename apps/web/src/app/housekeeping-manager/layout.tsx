import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';
import { HousekeepingManagerShell } from '@/components/housekeeping-manager/HousekeepingManagerShell';

export default async function HousekeepingManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = String((session.user as any).role || '').toUpperCase();
  const capabilities = ((session.user as any).capabilities || []) as string[];
  if (role !== 'HOUSEKEEPING_MAINTENANCE_MANAGER' && !(capabilities.includes('ACCESS_HOUSEKEEPING') && capabilities.includes('ACCESS_MAINTENANCE'))) redirect('/hub');
  try { await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', (session.user as any).propertyId); } catch { redirect(`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app'}/portal/subscription?required=MODULE_OPERATIONS`); }
  return <HousekeepingManagerShell>{children}</HousekeepingManagerShell>;
}

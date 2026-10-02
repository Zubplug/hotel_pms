import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

export default async function PosLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
  } catch {
    redirect('/settings/billing?required=MODULE_OPERATIONS');
  }
  return (
    <div className="h-screen w-screen bg-slate-50 overflow-hidden flex flex-col">
      {children}
    </div>
  );
}

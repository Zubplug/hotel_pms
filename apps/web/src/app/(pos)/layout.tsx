import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireModuleAccess } from '@/lib/auth/module-access';

export default async function PosLayout({ children }: { children: ReactNode }) {
  // POS is delivered in the static desktop bundle. Its local terminal license
  // and operator session are enforced by the native provider/PosApp, so this
  // server-only cloud entitlement check must not run in offline desktop mode.
  if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') {
    return (
      <div className="h-screen w-screen bg-slate-50 overflow-hidden flex flex-col">
        {children}
      </div>
    );
  }

  const session = await auth();
  if (!session?.user) redirect('/login');
  try {
    await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', session.user.propertyId);
  } catch {
    redirect(`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app'}/portal/subscription?required=MODULE_OPERATIONS`);
  }
  return (
    <div className="h-screen w-screen bg-slate-50 overflow-hidden flex flex-col">
      {children}
    </div>
  );
}

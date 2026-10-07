'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';

export function KitchenLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: session, status } = useLodgeCoreSession();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || !session?.user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#101313] text-orange-400">Loading kitchen workspace…</div>;
  }

  const user = session.user as any;
  const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.name || user.email || 'Kitchen staff';
  const initials = name.split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase();
  const nav = [
    { href: '/fnb/kitchen', label: 'Kitchen dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="flex min-h-screen bg-[#101313] text-slate-100">
      {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r border-white/10 bg-[#171b1a] transition-transform lg:static lg:translate-x-0', open && 'translate-x-0')}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white"><ChefHat className="h-6 w-6" /></div>
          <div><p className="font-bold text-white">LodgeCore</p><p className="text-[10px] uppercase tracking-[.18em] text-orange-400">Kitchen workspace</p></div>
          <button aria-label="Close menu" className="ml-auto lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn('flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold', active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}><Icon className="h-5 w-5" />{label}</Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-300">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="text-xs text-slate-500">{user.role?.replace(/_/g, ' ') || 'Kitchen staff'}</p></div></div>
          <button onClick={() => logout()} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex h-16 items-center border-b border-white/10 bg-[#151918] px-4 lg:px-8"><button aria-label="Open menu" className="mr-4 lg:hidden" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button><div><p className="text-xs uppercase tracking-[.18em] text-orange-400">Kitchen operations</p><p className="font-semibold text-white">Service control room</p></div></header>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

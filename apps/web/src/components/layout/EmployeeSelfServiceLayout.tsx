'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarCheck2, Home, LogOut, Menu, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';

export function EmployeeSelfServiceLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: session, status } = useLodgeCoreSession();

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [router, status]);

  if (status === 'loading' || !session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111c] text-slate-200">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  const name = session.user.name?.trim() || 'Employee';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ME';
  const nav = [
    { href: '/hr/self-service', label: 'My dashboard', icon: Home },
  ];

  const SideNav = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn('flex h-full flex-col border-r border-white/10 bg-[#091522]', mobile ? 'w-72' : 'w-64')}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-lg shadow-teal-950/40">
          <UserRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-white">LodgeCore</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">Employee portal</p>
        </div>
      </div>

      <div className="flex-1 px-3 py-6">
        <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">My workspace</p>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                  active ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-200">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{name}</p>
            <p className="truncate text-[10px] text-slate-500">Personal account</p>
          </div>
        </div>
        <button onClick={() => logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#07111c] text-slate-100">
      <div className="hidden lg:block"><SideNav /></div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0"><Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} className="absolute right-2 top-3 z-10 text-slate-300"><X className="h-5 w-5" /></Button><SideNav mobile /></div>
        </div>
      )}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#07111c]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setMenuOpen(true)} className="border-white/10 bg-white/5 text-slate-300 lg:hidden" aria-label="Open employee navigation"><Menu className="h-4 w-4" /></Button>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">Employee self-service</p><p className="text-sm font-semibold text-white">Your workplace hub</p></div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><CalendarCheck2 className="h-4 w-4 text-teal-400" />Manage your work life in one place</div>
        </header>
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </main>
    </div>
  );
}

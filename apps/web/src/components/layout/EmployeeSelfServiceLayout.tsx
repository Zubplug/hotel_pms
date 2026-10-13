'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarCheck2, Home, LogOut, UserRound, X, ShieldCheck, WalletCards, MessageSquare, ReceiptText, ChevronRight } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/hr/self-service', label: 'My dashboard', short: 'Home', icon: Home },
  { href: '/hr/self-service/pay', label: 'My pay', short: 'Pay', icon: WalletCards },
  { href: '/hr/self-service/support', label: 'HR support', short: 'Support', icon: MessageSquare },
  { href: '/hr/self-service/expenses', label: 'My reimbursements', short: 'Claims', icon: ReceiptText },
  { href: '/hr/self-service/security', label: 'Account security', short: 'Account', icon: ShieldCheck },
];

export function EmployeeSelfServiceLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: session, status } = useLodgeCoreSession();

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [router, status]);

  React.useEffect(() => { setMenuOpen(false); }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  if (status === 'loading' || !session?.user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#07111c] text-slate-200">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  const name = session.user.name?.trim() || 'Employee';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'ME';
  const isActive = (href: string) => (href === '/hr/self-service' ? pathname === href : pathname?.startsWith(href));
  const current = NAV.find((n) => isActive(n.href));

  const SideNav = () => (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-white/10 bg-[#091522]">
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
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors', isActive(href) ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
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
    <div className="ess-shell flex min-h-[100dvh] bg-[#07111c] text-slate-100">
      <div className="hidden lg:block"><SideNav /></div>

      <main className="min-w-0 flex-1">
        {/* Mobile app bar */}
        <header className="ess-topbar sticky top-0 z-30 border-b border-white/10 bg-[#07111c]/90 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 lg:hidden">
                <UserRound className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">LodgeCore · Employee</p>
                <p className="truncate text-sm font-semibold text-white">{current?.label || 'Your workplace hub'}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex"><CalendarCheck2 className="h-4 w-4 text-teal-400" />Manage your work life in one place</div>
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open account menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-bold text-teal-200 ring-1 ring-teal-400/25 active:scale-95 lg:hidden">
              {initials}
            </button>
          </div>
        </header>

        <div className="ess-content min-h-[calc(100dvh-3.5rem)]">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Employee navigation" className="ess-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#091522]/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, short, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors active:scale-95', active ? 'text-teal-300' : 'text-slate-500')}>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-400" />}
                <span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-teal-400/15')}>
                  <Icon className="h-5 w-5" />
                </span>
                {short}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile account sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Account menu">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="ess-sheet-in absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-[#0c1b2b] px-4 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-sm font-black text-white">{initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">{name}</p>
                  <p className="text-xs text-slate-400">Personal account</p>
                </div>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={cn('flex items-center gap-3 border-b border-white/5 px-4 py-3.5 text-sm last:border-0', isActive(href) ? 'text-teal-200' : 'text-slate-200')}>
                  <Icon className="h-5 w-5 text-slate-400" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </Link>
              ))}
            </div>
            <button onClick={() => logout()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 text-sm font-semibold text-rose-300 active:scale-[.98]">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

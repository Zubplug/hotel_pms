'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { useLogout } from '@/hooks/useLogout';
import { cn } from '@/lib/utils';
import {
  BarChart3, Bell, ClipboardList, DoorOpen, LayoutDashboard, Package, ReceiptText,
  LogOut, Menu, Sparkles, Wrench, X,
} from 'lucide-react';

const NAVIGATION = [
  { label: 'Command center', href: '/housekeeping-manager', icon: LayoutDashboard },
  { label: 'Room operations', href: '/housekeeping-manager/tasks', icon: ClipboardList },
  { label: 'Maintenance control', href: '/housekeeping-manager/maintenance', icon: Wrench },
  { label: 'Room readiness', href: '/housekeeping-manager/rooms', icon: DoorOpen },
  { label: 'Housekeeping inventory', href: '/housekeeping-manager/inventory', icon: Package },
  { label: 'Expense requests', href: '/housekeeping-manager/expenses', icon: ReceiptText },
  { label: 'Performance reports', href: '/housekeeping-manager/reports', icon: BarChart3 },
];

export function HousekeepingManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useLodgeCoreSession();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = session?.user?.name || session?.user?.email || 'Operations manager';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#07111f] text-slate-100">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[274px] -translate-x-full flex-col border-r border-white/[0.08] bg-[#0a1728] transition-transform lg:static lg:translate-x-0', mobileOpen && 'translate-x-0')}>
        <div className="flex h-[78px] items-center justify-between border-b border-white/[0.08] px-6">
          <Link href="/housekeeping-manager" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-400 text-[#06202a] shadow-lg shadow-cyan-900/30"><Sparkles className="h-5 w-5" /></span>
            <span><span className="block text-[15px] font-bold tracking-tight text-white">LodgeCore</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Rooms &amp; care</span></span>
          </Link>
          <button className="text-slate-500 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <div className="border-b border-white/[0.08] px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Management workspace</p>
          <p className="mt-2 text-sm font-semibold text-white">Housekeeping &amp; Maintenance</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Stanzel Grand Resort</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Operations</p>
          {NAVIGATION.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/housekeeping-manager' && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cn('group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition', active ? 'bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15' : 'text-slate-400 hover:bg-white/[0.045] hover:text-white')}><Icon className={cn('h-4 w-4', active ? 'text-cyan-300' : 'text-slate-600 group-hover:text-slate-300')} />{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />}</Link>;
          })}
        </nav>

        <div className="border-t border-white/[0.08] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[0.035] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-xs font-bold text-cyan-200">{initials || 'FM'}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{displayName}</span><span className="block truncate text-[10px] text-slate-500">Property manager</span></span></div>
          <button onClick={() => logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between border-b border-white/[0.08] bg-[#07111f]/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3"><button className="rounded-xl border border-white/[0.08] p-2 text-slate-400 hover:text-white lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Stanzel Grand Resort</p><p className="mt-1 text-sm font-semibold text-white">Rooms &amp; care command center</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live operations</span><button className="rounded-xl border border-white/[0.08] p-2 text-slate-500 hover:text-white" aria-label="Notifications"><Bell className="h-4 w-4" /></button></div>
        </header>
        <div className="min-h-[calc(100vh-78px)] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),#07111f]">{children}</div>
      </main>
    </div>
  );
}

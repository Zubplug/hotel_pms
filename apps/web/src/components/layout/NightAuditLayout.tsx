'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  Hotel,
  Menu,
  MoonStar,
  Clock,
  AlertTriangle,
  FileText,
  LogOut,
  ChevronDown,
  Server,
  ShieldCheck,
  ArrowUpRight,
  Circle,
  WalletCards
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from 'next-auth/react';
import { useLogout } from '@/hooks/useLogout';
import { PropertySelector } from '@/components/properties/PropertySelector';

const NIGHT_AUDIT_NAV = [
  { name: 'Audit overview', href: '/night-audit', icon: MoonStar, group: 'Workspace' },
  { name: 'Audit history', href: '/night-audit/history', icon: Clock, group: 'Workspace' },
  { name: 'Exceptions & variances', href: '/night-audit/exceptions', icon: AlertTriangle, group: 'Controls' },
  { name: 'Shift reviews', href: '/night-audit/shift-reviews', icon: FileText, group: 'Controls' },
  { name: 'Cash handovers', href: '/night-audit/handovers', icon: WalletCards, group: 'Controls' },
  { name: 'Audit reports', href: '/night-audit/reports', icon: FileText, group: 'Insights' },
  { name: 'System & sync', href: '/night-audit/system', icon: Server, group: 'Insights' },
];

export function NightAuditLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const userDisplay = session?.user?.name || session?.user?.email || 'Staff member';
  
  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (session?.user?.email ? session.user.email.substring(0, 2).toUpperCase() : '??');
  
  const role = (session?.user as any)?.role || 'STAFF';

  // Block render while session is resolving
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Night Audit&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07111f] text-slate-300">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      {/* Logo */}
      <div className="relative flex shrink-0 flex-col gap-5 px-5 pb-5 pt-6">
        <Link href="/night-audit" className="group flex items-center gap-3 px-1">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_8px_24px_rgba(99,102,241,0.35)] ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <Hotel className="h-[21px] w-[21px] text-white" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">LodgeCore</span>
            <span className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Operations suite</span>
          </div>
        </Link>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.055] p-3.5 shadow-xl shadow-black/10">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.12] via-transparent to-violet-500/[0.08]" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/15"><ShieldCheck className="h-4 w-4" /></span>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Audit control</p><p className="mt-0.5 text-xs font-medium text-slate-200">Night shift active</p></div>
            </div>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300"><Circle className="h-1.5 w-1.5 fill-current" /> Live</span>
          </div>
          <div className="relative mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3"><span className="text-[11px] text-slate-500">Workspace</span><span className="text-[11px] font-medium text-slate-300">Night audit</span></div>
        </div>
      </div>

      {/* Nav */}
      <div className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-5 pt-1 [scrollbar-width:thin] [scrollbar-color:#26334a_transparent]">
        {['Workspace', 'Controls', 'Insights'].map((group) => <div key={group} className="space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{group}</div>
          {NIGHT_AUDIT_NAV.map((item) => {
          if (item.group !== group) return null;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100'
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-white/[0.09]" />
              )}
              {isActive && (
                <div className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-indigo-300 to-violet-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
              )}
              <item.icon
                className={cn(
                  'relative z-10 h-[17px] w-[17px] shrink-0 transition-all duration-200',
                  isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span className="relative z-10">{item.name}</span>
              {item.badge && <span className="relative z-10 ml-auto rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-300/15">{item.badge}</span>}
              {isActive && <ArrowUpRight className="relative z-10 ml-auto h-3.5 w-3.5 text-indigo-300/70" />}
            </Link>
          );
          })}
        </div>)}
      </div>

      {/* User footer */}
      <div className="relative shrink-0 space-y-3 border-t border-white/[0.08] p-4">
        <div className="flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600"><span>Shift progress</span><span className="text-slate-500">72%</span></div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" /></div>
        <DropdownMenu>
          <DropdownMenuTrigger className="group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.055] p-3 outline-none transition-all hover:bg-white/[0.09] hover:ring-1 hover:ring-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-slate-200 ring-1 ring-white/10 shadow-inner transition-colors duration-300 group-hover:from-indigo-600 group-hover:to-violet-700 group-hover:text-white">
                {userInitials}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col items-start overflow-hidden">
              <span className="w-full truncate text-left text-xs font-semibold text-slate-200 transition-colors group-hover:text-white">{userDisplay}</span>
              <span className="w-full truncate text-left text-[10px] font-medium uppercase tracking-wider text-slate-500 transition-colors group-hover:text-indigo-300">
                {role === 'MANAGER' ? 'Night Manager' : role === 'GENERAL_CASHIER' ? 'General Cashier' : 'Auditor'}
              </span>
            </div>
            <ChevronDown className="relative h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 group-hover:text-slate-300 group-hover:-translate-y-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[248px] rounded-xl border-slate-200 p-2 shadow-xl mb-2 ml-4">
              <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer rounded-lg font-medium p-2.5">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[296px] flex-col bg-[#07111f] shadow-2xl transition-transform">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[296px] flex-col border-r border-slate-800/70 bg-[#07111f] shadow-[12px_0_40px_rgba(2,6,23,0.12)] lg:flex print:hidden">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[296px] print:pl-0 transition-all duration-300">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:px-6 print:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </Button>

          <div className="flex items-center gap-3">
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 print:bg-white print:overflow-visible">
          <div className="mx-auto max-w-screen-2xl print:max-w-none print:mx-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

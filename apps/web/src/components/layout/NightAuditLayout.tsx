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
  Server
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
  { name: 'Audit overview', href: '/night-audit', icon: MoonStar },
  { name: 'Audit History', href: '/night-audit/history', icon: Clock },
  { name: 'Exceptions & Variances', href: '/night-audit/exceptions', icon: AlertTriangle },
  { name: 'Audit Reports', href: '/night-audit/reports', icon: FileText },
  { name: 'System & Sync', href: '/night-audit/system', icon: Server },
  { name: 'Shift Reviews', href: '/night-audit/shift-reviews', icon: FileText },
  { name: 'Cash Handovers', href: '/night-audit/handovers', icon: Server },
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

  const userDisplay = session?.user?.name || 'Staff member';
  
  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  
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
    <>
      {/* Logo */}
      <div className="flex h-24 shrink-0 items-center gap-3 px-6 pt-4">
        <Link href="/night-audit" className="group relative flex w-full items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:shadow-xl hover:shadow-black/20 hover:ring-white/20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 shadow-inner ring-1 ring-white/20 transition-all duration-300 group-hover:rotate-3 group-hover:scale-105">
            <Hotel className="h-5 w-5 text-white drop-shadow-md" />
          </div>
          <div className="relative flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold tracking-tight text-white drop-shadow-sm">LodgeCore PMS</span>
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/90">Night Audit</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-6">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Menu</div>
        {NIGHT_AUDIT_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 overflow-hidden',
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/10 opacity-100" />
              )}
              {isActive && (
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-r-full shadow-[0_0_12px_rgba(129,140,248,0.8)]" />
              )}
              {!isActive && (
                <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
              )}
              <item.icon
                className={cn(
                  'relative z-10 h-[18px] w-[18px] shrink-0 transition-all duration-300',
                  isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'
                )}
              />
              <span className="relative z-10">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="shrink-0 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white/5 p-3 outline-none ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20 shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-bold text-slate-200 ring-1 ring-white/10 shadow-inner transition-colors duration-300 group-hover:from-indigo-600 group-hover:to-purple-700 group-hover:text-white">
                {userInitials}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col items-start overflow-hidden">
              <span className="w-full truncate text-left text-sm font-semibold text-slate-200 transition-colors group-hover:text-white">{userDisplay}</span>
              <span className="w-full truncate text-left text-[11px] font-medium text-slate-500 transition-colors group-hover:text-indigo-300">
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
    </>
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
          <div className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#020617] shadow-2xl transition-transform">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-slate-800/60 bg-[#020617] shadow-xl lg:flex print:hidden">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-[280px] min-w-0 print:pl-0 transition-all duration-300">
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

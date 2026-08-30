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

  const userInitials = session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : '??';
  
  const role = (session?.user as any)?.role || 'STAFF';
  const userDisplay = session?.user?.name || session?.user?.email || 'Staff member';

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
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <Link href="/night-audit" className="group flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40 transition-transform group-hover:scale-105">
            <Hotel className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-white">LodgeCore PMS</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-indigo-400">Night Audit</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto bg-[#0b1120] px-3 py-5">
        {NIGHT_AUDIT_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/5 bg-[#0b1120] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-white/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white ring-2 ring-indigo-500/30">
                {userInitials}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start overflow-hidden">
              <span className="w-full truncate text-left text-sm font-medium text-slate-200">{userDisplay}</span>
              <span className="w-full truncate text-left text-xs capitalize text-slate-500">{role === 'MANAGER' ? 'Night manager' : 'Auditor'}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive cursor-pointer">
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
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/5 bg-[#0b1120] shadow-xl">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-[#0b1120] lg:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3">
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto max-w-screen-2xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

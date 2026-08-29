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
  Server,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLodgeCoreSession } from '@/hooks/useLodgeCoreSession';
import { useLogout } from '@/hooks/useLogout';
import { PropertySelector } from './PropertySelector';
import { AppSwitcher } from './AppSwitcher';

const NIGHT_AUDIT_NAV = [
  { name: 'Execution Wizard', href: '/night-audit', icon: MoonStar },
  { name: 'Audit History', href: '/night-audit/history', icon: Clock },
  { name: 'Exceptions & Variances', href: '/night-audit/exceptions', icon: AlertTriangle },
  { name: 'Reports Generator', href: '/night-audit/reports', icon: FileText },
  { name: 'System & Sync', href: '/night-audit/system', icon: Server },
];

export function NightAuditLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
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
      <div className="flex h-16 shrink-0 items-center px-6 border-b gap-3 bg-indigo-950 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow shadow-indigo-500/30">
          <MoonStar className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">Night Auditor</span>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-2 bg-slate-900">
        {NIGHT_AUDIT_NAV.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 shrink-0 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t border-slate-800 bg-slate-900 px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg hover:bg-slate-800 transition-colors cursor-pointer outline-none w-full">
            <div className="flex w-full items-center gap-3 px-2 py-2 text-sm text-slate-300">
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate text-slate-200">
                  {session?.user?.email ?? 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {role === 'MANAGER' ? 'Night Manager' : 'Auditor'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
            </div>
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
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-slate-800 lg:bg-slate-900">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 items-center gap-4">
            <AppSwitcher />
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-10 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

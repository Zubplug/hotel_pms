'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Menu,
  Hotel,
  LogOut,
  ChevronDown,
  type LucideIcon,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = {
  section: string;
  name: string;
  href: string;
  icon: LucideIcon;
};

const AUDITOR_NAV: NavItem[] = [
  { section: 'Audit Hub', name: 'Command Center', href: '/external-auditor', icon: LayoutDashboard },
  { section: 'Audit Hub', name: 'Audit Evidence', href: '/external-auditor/evidence', icon: Search },
  { section: 'Reports', name: 'Financial Reports', href: '/external-auditor/reports', icon: FileText },
];

export function ExternalAuditorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();
  const [scope, setScope] = useState<{ propertyName: string; auditPeriodStart: string; auditPeriodEnd: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void fetch('/api/v1/external-auditor/context').then((response) => response.json()).then((value) => {
      if (value.scopes?.[0]) setScope(value.scopes[0]);
    }).catch(() => undefined);
  }, [status]);

  const userDisplayName = session?.user?.name?.trim() || session?.user?.email || 'External Auditor';
  const userInitials = userDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase() || 'EA';

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-slate-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Loading Secure Portal&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-800 gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 shadow shadow-slate-900/50">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-slate-200">EXTERNAL AUDITOR</span>
          <span className="text-[10px] uppercase text-emerald-500 font-medium tracking-widest">Read-Only Access</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-1">
        {AUDITOR_NAV.map((item, index) => {
          const isActive = pathname === item.href || (item.href !== '/external-auditor' && pathname?.startsWith(item.href));

          return (
            <div key={item.name}>
              {item.section !== AUDITOR_NAV[index - 1]?.section && (
                <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 first:mt-0">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-slate-800 text-slate-200 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-4.5 w-4.5 shrink-0 transition-colors',
                    isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'
                  )}
                />
                {item.name}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-800 px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer outline-none w-full">
            <div className="flex w-full items-center gap-3 px-2 py-2 text-sm text-slate-300">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0 border border-slate-700">
                {userInitials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {userDisplayName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Independent Auditor
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56 bg-slate-900 border-slate-800 text-slate-200">
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:text-red-300 focus:bg-slate-800 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-slate-800 lg:bg-slate-900">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 items-center justify-between gap-4">
            {/* Context Header for Auditor */}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-300">Secure Audit Session Active</span>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
               <span>Property: {scope?.propertyName || 'Loading…'}</span>
               <span className="text-slate-600">|</span>
               <span>Audit Period: {scope ? `${new Date(scope.auditPeriodStart).toLocaleDateString()} - ${new Date(scope.auditPeriodEnd).toLocaleDateString()}` : 'Loading…'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-10 custom-scrollbar">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

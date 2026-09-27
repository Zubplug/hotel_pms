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
  LogOut,
  ChevronDown,
  type LucideIcon,
  Search,
  LockKeyhole,
  ClipboardCheck,
  Activity,
  GitCompareArrows,
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
  { section: 'Engagement', name: 'Command center', href: '/external-auditor', icon: LayoutDashboard },
  { section: 'Engagement', name: 'Evidence explorer', href: '/external-auditor/evidence', icon: Search },
  { section: 'Engagement', name: 'Audit operations', href: '/external-auditor/operations', icon: ClipboardCheck },
  { section: 'Engagement', name: 'Readiness & activity', href: '/external-auditor/readiness', icon: Activity },
  { section: 'Deliverables', name: 'Reconciliation center', href: '/external-auditor/assurance', icon: GitCompareArrows },
  { section: 'Deliverables', name: 'Reports & exports', href: '/external-auditor/reports', icon: FileText },
];

export function ExternalAuditorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();
  const [scope, setScope] = useState<{ propertyName: string; auditPeriodStart: string; auditPeriodEnd: string; accessExpiresAt: string } | null>(null);

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

  const sidebarProps = { pathname, userDisplayName, userInitials, logout, scopeExpiresAt: scope?.accessExpiresAt };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col">
            <AuditorSidebar {...sidebarProps} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative z-40 hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-slate-800 lg:bg-slate-900 pointer-events-auto">
        <AuditorSidebar {...sidebarProps} />
      </div>

      <div className="relative flex flex-1 flex-col lg:pl-64 min-w-0">
        <main className="relative flex-1 overflow-y-auto pb-10 custom-scrollbar">
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 bg-slate-900/90 text-slate-400 shadow-lg ring-1 ring-white/10 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open auditor navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function AuditorSidebar({ pathname, userDisplayName, userInitials, logout, scopeExpiresAt, onNavigate }: { pathname: string | null; userDisplayName: string; userInitials: string; logout: () => void; scopeExpiresAt?: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-[76px] shrink-0 items-center px-5 border-b border-white/[.07] gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/10">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold tracking-[.14em] text-white">LODGECORE</span>
          <span className="text-[10px] uppercase text-emerald-400 font-semibold tracking-[.18em]">Audit workspace</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5 gap-1">
        <div className="mb-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /> Controlled access</div>
          <p className="text-xs leading-5 text-slate-400">Read-only engagement workspace. Every view is limited to the authorized property and period.</p>
          {scopeExpiresAt && <p className="mt-3 border-t border-emerald-400/10 pt-3 text-[11px] text-slate-500">Access expires <span className="font-medium text-slate-300">{new Date(scopeExpiresAt).toLocaleDateString()}</span></p>}
        </div>
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
                    ? 'bg-white/[.09] text-white shadow-sm ring-1 ring-white/[.06]'
                    : 'text-slate-400 hover:bg-white/[.05] hover:text-slate-200'
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
              <div className="h-8 w-8 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-300 text-xs font-bold shrink-0 border border-emerald-400/20">
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
}

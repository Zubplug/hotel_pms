'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import {
  Hotel,
  LogOut,
  ChevronDown,
  HandCoins,
  Activity,
  BedDouble,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PropertySelector } from '@/components/properties/PropertySelector';

const CASH_MANAGEMENT_NAV = [
  {
    name: 'Cash Management',
    icon: HandCoins,
    children: [
      { name: 'Overview', href: '/cash-management' },
      { name: 'Shifts', href: '/reports/shift' },
      { name: 'Cash Handovers', href: '/handovers' },
      { name: 'Bank Deposits', href: '/deposits', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Cash Expenses', href: '/expenses', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Receivables', href: '/reports/receivables', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Corporate Management', href: '/cashier/corporate', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Night Audit', href: '/cash-management/night-audit' },
      { name: 'Audit Reports', href: '/cash-management/night-audit/reports', roles: ['GENERAL_CASHIER', 'NIGHT_AUDITOR', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Room Analysis', href: '/cash-management/room-analysis' },
      { name: 'Transaction Exceptions', href: '/cash-management/transaction-exceptions', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Approval Control Center', href: '/cashier/approval-center', roles: ['GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'] },
    ],
  },
  {
    name: 'F&B Cost Control',
    icon: Activity,
    children: [
      { name: 'Cost Dashboard', href: '/inventory/cost-control', roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'MANAGER', 'DIRECTOR', 'ADMIN', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Recipes', href: '/inventory/cost-control/recipes', roles: ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'MANAGER', 'DIRECTOR', 'ADMIN', 'CEO', 'SUPER_ADMIN'] },
      { name: 'Stocktakes', href: '/inventory/stocktakes' },
      { name: 'Opening Stock', href: '/inventory/opening-stock', roles: ['GENERAL_CASHIER'] },
      { name: 'GRNs', href: '/inventory/grns' },
    ],
  },
];

export function CashManagementLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasMultipleProperties, setHasMultipleProperties] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const sessionUser = session?.user as any;
  const userFullName = sessionUser?.firstName && sessionUser?.lastName
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : sessionUser?.name && sessionUser.name !== sessionUser.email
      ? sessionUser.name
      : 'Staff';
  const userInitials = userFullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase() || 'ST';

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0a1020] via-[#0d172b] to-[#080d18]">
      {/* Logo */}
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-600 to-violet-700 shadow-lg shadow-indigo-950/60 ring-1 ring-white/15">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold tracking-tight text-white">LodgeCore PMS</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Cash operations</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-5">
        {CASH_MANAGEMENT_NAV.map((section) => (
          <div key={section.name} className="flex flex-col gap-1">
            <div className="mb-2 flex items-center gap-2 px-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06]"><section.icon className="h-3 w-3 text-indigo-300" /></span>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {section.name}
              </h3>
            </div>
            {section.children.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              if ((item as any).roles && !(item as any).roles.includes(String((session.user as any).role || '').toUpperCase())) return null;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex items-center rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-300/20'
                      : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'
                  )}
                >
                  <span className={cn('mr-3 h-1.5 w-1.5 rounded-full transition-colors', isActive ? 'bg-white' : 'bg-slate-700 group-hover:bg-indigo-300')} />
                  {item.name}
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-200 shadow-[0_0_8px_rgba(199,210,254,0.9)]" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/[0.07] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-white/[0.07]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white ring-1 ring-white/15">
                {userInitials}
              </div>
              <div className="flex flex-1 flex-col items-start overflow-hidden">
                <span className="truncate text-sm font-medium text-slate-200 w-full text-left">
                  {userFullName}
                </span>
                <span className="truncate text-xs text-slate-500 w-full text-left">
                  {(session.user as any)?.role?.replace(/_/g, ' ') || 'Staff'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0 group-hover:text-slate-300 transition-colors" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#080e1f] cashier-dark-surface font-sans overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close */}
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-white lg:hidden z-10"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <main className="relative flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Property switcher header is only useful when the user can switch properties. */}
        {hasMultipleProperties && (
          <header className="h-14 shrink-0 border-b border-white/[0.08] bg-[#0a0c22]/95 backdrop-blur flex items-center justify-end px-4 sticky top-0 z-30 shadow-sm">
            <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
          </header>
        )}

        {/* Keep navigation available on mobile when there is no property switcher header. */}
        {!hasMultipleProperties && (
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 top-4 z-30 h-9 w-9 border-white/[0.08] bg-white/[0.03] text-white shadow-sm hover:bg-white/[0.08] lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Mount the selector even when the header is hidden so property access is resolved. */}
          {!hasMultipleProperties && (
            <div className="hidden">
              <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

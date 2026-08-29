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
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
      { name: 'Bank Deposits', href: '/deposits' },
      { name: 'Cash Expenses', href: '/expenses' },
      { name: 'Receivables', href: '/reports/receivables' },
      { name: 'POS Menu & Prices', href: '/cashier/menu' },
      { name: 'Price Requests', href: '/cashier/price-approvals', roles: ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'CEO', 'SUPER_ADMIN'] },
    ],
  },
  {
    name: 'F&B Cost Control',
    icon: Activity,
    children: [
      { name: 'Cost Dashboard', href: '/inventory/cost-control' },
      { name: 'Recipes', href: '/inventory/cost-control/recipes' },
      { name: 'Stocktakes', href: '/inventory/stocktakes' },
      { name: 'GRNs', href: '/inventory/grns' },
    ],
  },
];

export function CashManagementLayout({ children }: { children: React.ReactNode }) {
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

  const userFullName =
    (session?.user as any)?.firstName && (session?.user as any)?.lastName
      ? `${(session?.user as any).firstName} ${(session?.user as any).lastName}`
      : session?.user?.email ?? '';

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
    <div className="flex h-full flex-col bg-[#0b1120]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-white tracking-tight">LodgeCore PMS</span>
          <span className="text-[10px] font-medium text-indigo-400 tracking-widest uppercase">General Cashier</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5 gap-6">
        {CASH_MANAGEMENT_NAV.map((section) => (
          <div key={section.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-3 mb-1">
              <section.icon className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">
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
                    'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5 group outline-none">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold text-xs ring-2 ring-indigo-500/30">
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
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top header */}
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}

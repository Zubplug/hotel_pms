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
  LayoutDashboard,
  Wallet,
  Landmark,
  CreditCard,
  Building,
  Receipt,
  FileSpreadsheet,
  MoonStar,
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

const ACCOUNTANT_NAV = [
  {
    name: 'Finance Workspace',
    icon: LayoutDashboard,
    children: [
      { name: 'Overview', href: '/accountant' },
      { name: 'Revenue Accounting', href: '/accountant/revenue' },
      { name: 'Accounts Receivable', href: '/accountant/receivables' },
      { name: 'City Ledger', href: '/accountant/city-ledger' },
      { name: 'Accounts Payable', href: '/accountant/payables' },
      { name: 'Cash & Bank', href: '/accountant/cash-bank' },
      { name: 'Expense Control', href: '/accountant/expenses' },
    ],
  },
  {
    name: 'Control & Audit',
    icon: Activity,
    children: [
      { name: 'General Ledger', href: '/accountant/gl' },
      { name: 'Fixed Assets', href: '/accountant/assets' },
      { name: 'Payroll Periods', href: '/accountant/payroll' },
      { name: 'Night Audit', href: '/night-audit' },
      { name: 'Tax Remittances', href: '/accountant/taxes' },
      { name: 'Budgets', href: '/accountant/budgets' },
    ],
  },
];

export function AccountantLayout({ children }: { children: React.ReactNode }) {
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
          <div className="h-10 w-10 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
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
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/40">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold tracking-wide text-white">LodgeCore</span>
          <span className="text-[10px] font-medium text-emerald-400 tracking-widest uppercase">Finance</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-8 overflow-y-auto p-4 custom-scrollbar">
        {ACCOUNTANT_NAV.map((section, idx) => (
          <div key={idx}>
            <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <section.icon className="h-4 w-4" />
              {section.name}
            </div>
            <div className="space-y-1">
              {section.children.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/accountant' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    )}
                  >
                    {item.name}
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-white/5 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-3 rounded-xl hover:bg-white/5 px-2 py-6 h-auto outline-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium">
                  {userInitials}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-slate-200 truncate w-full">
                    {userFullName}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium tracking-wide">
                    Accountant
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl border-slate-800 bg-slate-900 text-slate-200"
          >
            <DropdownMenuItem
              className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white cursor-pointer rounded-lg mx-1 my-1"
              onClick={() => router.push('/settings/general')}
            >
              System Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-400 cursor-pointer rounded-lg mx-1 my-1"
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
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block border-r border-white/5">
        <Sidebar />
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="lg:hidden flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#0b1120] px-4 absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/20">
            <Hotel className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-wide text-white">Finance</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-slate-400">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-[#0b1120] shadow-2xl animate-in slide-in-from-left">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-3 text-slate-400 hover:text-white z-50"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden pt-16 lg:pt-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-slate-950 px-6">
          <h1 className="text-sm font-medium text-slate-400 hidden lg:block">Finance & Accounting Workspace</h1>
          <div className="flex items-center gap-4 ml-auto lg:ml-0">
            <PropertySelector />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

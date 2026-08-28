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
  FileText,
  HandCoins,
  Activity,
  Package,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Menu
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
import { AppSwitcher } from '@/components/layout/AppSwitcher';

const CASH_MANAGEMENT_NAV = [
  {
    name: 'Cash Management',
    href: '#',
    icon: HandCoins,
    children: [
      { name: 'Overview', href: '/cash-management' },
      { name: 'Shifts', href: '/reports/shift' },
      { name: 'Receivables', href: '/reports/receivables' },
      { name: 'Gateway', href: '/reports/gateway' },
    ]
  },
  {
    name: 'F&B Cost Control',
    href: '#',
    icon: Activity,
    children: [
      { name: 'Cost Dashboard', href: '/inventory/cost-control' },
      { name: 'Recipes', href: '/inventory/cost-control/recipes' },
      { name: 'Stocktakes', href: '/inventory/stocktakes' },
      { name: 'GRNs', href: '/inventory/grns' },
      { name: 'Variance Analysis', href: '/inventory/reconciliation' },
    ]
  }
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
  
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex h-16 shrink-0 items-center px-6 border-b gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow shadow-blue-500/30">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">LodgeCore PMS</span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-6">
        {CASH_MANAGEMENT_NAV.map((section) => (
          <div key={section.name} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
              {section.name}
            </h3>
            {section.children?.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-auto border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-2 hover:bg-muted/60 h-auto py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                {userInitials}
              </div>
              <div className="flex flex-1 flex-col items-start overflow-hidden">
                <span className="truncate text-sm font-medium text-foreground w-full text-left">
                  {session.user.email}
                </span>
                <span className="truncate text-xs text-muted-foreground w-full text-left">
                  {session.user.role?.replace(/_/g, ' ') || 'Staff'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="w-full cursor-pointer">
                My Profile
              </Link>
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
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile */}
      <div className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <AppSwitcher />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <PropertySelector />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}

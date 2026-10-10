'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { CashManagementLayout } from './CashManagementLayout';
import { AccountantLayout } from './AccountantLayout';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Users,
  Settings,
  Menu,
  Hotel,
  LogOut,
  ChevronDown,
  Layers,
  Star,
  CalendarDays,
  FileText,
  MoonStar,
  Clock3,
  Scale,
  Shirt,
  Wrench,
  Brush,
  HandCoins,
  WalletCards,
  CircleDollarSign,
  BadgeDollarSign,
  ClipboardCheck,
  Package,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Bell,
  BarChart3,
  Utensils,
  RefreshCw,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PropertySelector } from '@/components/properties/PropertySelector';
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
  module?: 'MODULE_PMS' | 'MODULE_OPERATIONS' | 'MODULE_ENTERPRISE';
  restrictedTo?: string[];
  children?: Array<{ name: string; href: string; restrictedTo?: string[] }>;
};

const ALL_NAV: NavItem[] = [
  { section: 'Portfolio', name: 'Overview', href: '/general-manager', icon: LayoutDashboard, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Portfolio', name: 'Properties', href: '/properties', icon: Hotel, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Portfolio', name: 'Rooms', href: '/rooms', icon: BedDouble, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST'] },
  { section: 'Portfolio', name: 'Room Types', href: '/room-types', icon: Layers, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Operations', name: 'Reservations', href: '/reservations', icon: CalendarDays },
  { section: 'Operations', name: 'Laundry', href: '/general-manager/laundry', icon: Shirt, module: 'MODULE_OPERATIONS', restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Operations', name: 'Maintenance', href: '/maintenance', icon: Wrench, module: 'MODULE_OPERATIONS' },
  { section: 'Operations', name: 'Housekeeping', href: '/housekeeping', icon: Brush, module: 'MODULE_OPERATIONS' },
  { section: 'Night Audit', name: 'Audit overview', href: '/general-manager/night-audit', icon: MoonStar, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Night Audit', name: 'Room & guest control', href: '/general-manager/night-audit/rooms', icon: BedDouble, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Night Audit', name: 'Revenue reconciliation', href: '/general-manager/night-audit/reconciliation', icon: Scale, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Night Audit', name: 'Audit history', href: '/general-manager/night-audit/history', icon: Clock3, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Night Audit', name: 'Audit reports', href: '/general-manager/night-audit/reports', icon: FileText, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Night Audit', name: 'Audit workbench', href: '/night-audit', icon: MoonStar, restrictedTo: ['NIGHT_AUDITOR'] },
  { section: 'Finance & Reports', name: 'Reports', href: '/reports', icon: FileText },
  { section: 'Cash Management', name: 'Control center', href: '/general-manager/cash-management', icon: HandCoins, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Cash Management', name: 'Cashier shifts', href: '/general-manager/cash-management/cashier-shifts', icon: BadgeDollarSign, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Cash Management', name: 'Receivables oversight', href: '/general-manager/cash-management/receivables', icon: CircleDollarSign, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Cash Management', name: 'Front desk settlement', href: '/general-manager/cash-management/frontdesk-settlement', icon: ArrowLeftRight, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'Accounting control center', href: '/general-manager/accounting', icon: Scale, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'Accounting reports', href: '/general-manager/accounting/reports', icon: FileText, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'Receivables oversight', href: '/general-manager/accounting/receivables', icon: WalletCards, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'City Ledger oversight', href: '/general-manager/accounting/city-ledger', icon: Building2, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'Payables oversight', href: '/general-manager/accounting/payables', icon: FileText, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'Tax position', href: '/general-manager/accounting/taxes', icon: Scale, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Accounting Management', name: 'GL integrity', href: '/general-manager/accounting/gl', icon: Scale, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Finance & Reports', name: 'Corporate Management', href: '/general-manager/corporate', icon: Building2, module: 'MODULE_OPERATIONS', restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Finance & Reports', name: 'Cash Management', href: '/cash-management', icon: HandCoins, restrictedTo: ['ACCOUNTANT', 'GENERAL_CASHIER', 'NIGHT_AUDITOR'] },
  { section: 'Finance & Reports', name: 'Approval Control Centre', href: '/general-manager/approvals', icon: ClipboardCheck, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Finance & Reports', name: 'Sync Center', href: '/sync-center', icon: RefreshCw, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR'] },

  { section: 'Administration', name: 'F&B Management', href: '/general-manager/fnb', icon: Utensils, module: 'MODULE_OPERATIONS', restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Administration', name: 'F&B Management', href: '/fnb/dashboard', icon: Utensils, module: 'MODULE_OPERATIONS', restrictedTo: ['FNB_MANAGER', 'EVENT_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER'] },

  { section: 'Administration', name: 'People & Access', href: '/settings/team', icon: Users, module: 'MODULE_PMS', restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'External Auditors', name: 'Auditor management', href: '/admin/external-auditors', icon: ShieldCheck, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'External Auditors', name: 'Active engagements', href: '/admin/external-auditors/engagements', icon: ShieldCheck, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'External Auditors', name: 'Invitations', href: '/admin/external-auditors/invite', icon: ShieldCheck, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'External Auditors', name: 'Final-pack sign-off', href: '/admin/external-auditors/final-pack', icon: ShieldCheck, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'External Auditors', name: 'Audit activity', href: '/admin/external-auditors/activity', icon: ShieldCheck, restrictedTo: ['ADMIN', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Administration', name: 'Amenities', href: '/amenities', icon: Star, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
  { section: 'Administration', name: 'Settings', href: '/settings', icon: Settings, restrictedTo: ['CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'] },
];

export function DashboardLayout({ children, enabledModules = [] }: { children: React.ReactNode; enabledModules?: readonly string[] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();

  const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';
  const isDarkWorkspace = pathname === '/properties'
    || pathname?.startsWith('/properties/')
    || pathname === '/rooms'
    || pathname?.startsWith('/rooms/')
    || pathname === '/maintenance'
    || pathname?.startsWith('/maintenance/')
    || pathname === '/room-types'
    || pathname?.startsWith('/room-types/')
    || pathname === '/reservations'
    || pathname?.startsWith('/reservations/')
    || pathname === '/general-manager'
    || pathname?.startsWith('/general-manager/')
    || pathname === '/admin'
    || pathname?.startsWith('/admin/');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const userDisplayName = session?.user?.name?.trim() || session?.user?.email || 'User';
  const userInitials = userDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase() || '??';

  const role = (session?.user as any)?.role || 'STAFF';
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;

  const navigation = ALL_NAV
    .filter(item => {
      if (item.module && !enabledModules.includes(item.module)) return false;
      if (item.restrictedTo) {
        if (isSuperAdmin) return true;
        return item.restrictedTo.includes(role);
      }
      return true;
    })
    .map(item => ({
      ...item,
      // Filter children by role too
      children: item.children?.filter(child => {
        if ((child as any).restrictedTo) {
          if (isSuperAdmin) return true;
          return (child as any).restrictedTo.includes(role);
        }
        return true;
      }),
    }));

  // Block render while session is resolving — prevents flash of admin content
  if (status === 'loading') {
    return (
      <div className={cn(
        'flex min-h-screen items-center justify-center',
        isDarkWorkspace ? 'bg-[#07111f] text-slate-200' : 'bg-muted/30'
      )}>
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'h-8 w-8 animate-spin rounded-full border-4 border-t-transparent',
            isDarkWorkspace ? 'border-emerald-300 border-t-transparent' : 'border-blue-600 border-t-transparent'
          )} />
          <p className="text-sm text-muted-foreground">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  if (role === 'GENERAL_CASHIER') {
    return <CashManagementLayout enabledModules={enabledModules}>{children}</CashManagementLayout>;
  }

  if (role === 'ACCOUNTANT') {
    return <AccountantLayout enabledModules={enabledModules}>{children}</AccountantLayout>;
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow shadow-blue-500/30">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">LodgeCore PMS</span>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-1">
        {navigation.map((item, index) => {
          const isChildActive = item.children?.some(child =>
            pathname === child.href || pathname?.startsWith(`${child.href}/`)
          );
          const isActive =
            pathname === item.href ||
            (item.href !== '/general-manager' && item.href !== '/admin/external-auditors' && pathname?.startsWith(item.href)) ||
            Boolean(isChildActive);
          
          return (
            <div key={item.name}>
              {item.section !== navigation[index - 1]?.section && (
                <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60 first:mt-0">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-4.5 w-4.5 shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                {item.name}
                {item.children && (
                  <ChevronDown className={cn(
                    "ml-auto h-4 w-4 transition-transform", 
                    isActive ? "rotate-180" : ""
                  )} />
                )}
              </Link>
              {item.children && isActive && (
                <div className="ml-9 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        pathname === child.href
                          ? 'bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg hover:bg-muted/60 transition-colors cursor-pointer outline-none">
            <div className="flex w-full items-center gap-3 px-2 py-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {userDisplayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {['SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'CEO'].includes(String(role).toUpperCase()) ? 'General Manager' : 'Staff'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
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
    <div className={cn('flex h-screen overflow-hidden bg-muted/30', isDarkWorkspace && 'pms-dark-shell')}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r shadow-xl flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </Button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-background">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <header className={cn(
          'sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b px-3 backdrop-blur lg:hidden sm:px-4',
          isDarkWorkspace ? 'border-white/[.10] bg-[#07111f]/95 text-white' : 'border-border/70 bg-background/95'
        )}>
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'h-10 w-10 shrink-0',
                isDarkWorkspace && 'border-white/[.12] bg-white/[.04] text-white hover:bg-white/[.10]'
              )}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open general manager navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className={cn('truncate text-[10px] font-bold uppercase tracking-[.16em]', isDarkWorkspace ? 'text-emerald-300' : 'text-primary')}>General Manager</p>
              <p className={cn('truncate text-xs font-medium', isDarkWorkspace ? 'text-slate-300' : 'text-muted-foreground')}>
                {pathname === '/general-manager' ? 'Executive overview' : pathname?.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') || 'Workspace'}
              </p>
            </div>
          </div>
          <PropertySelector className={cn('max-w-[150px] sm:max-w-[220px]', isDarkWorkspace && 'border-white/[.12] bg-white/[.04] text-white hover:bg-white/[.10]')} />
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-10">
          <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

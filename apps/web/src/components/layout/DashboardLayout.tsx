'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
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
  Brush,
  Wrench,
  HandCoins,
  Shirt,
  BadgeDollarSign,
  Package,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  BarChart3,
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

const ALL_NAV = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
  { name: 'Front Desk', href: '/frontdesk', icon: LayoutDashboard, restrictedTo: ['RECEPTIONIST', 'FRONT_DESK', 'SUPER_ADMIN', 'MANAGER'] },
  { name: 'Properties', href: '/properties', icon: Hotel, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
  { name: 'Rooms', href: '/rooms', icon: BedDouble, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { name: 'Room Types', href: '/room-types', icon: Layers, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
  { name: 'Amenities', href: '/amenities', icon: Star, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
  { name: 'Reservations', href: '/reservations', icon: CalendarDays }, // Available to all staff
  { name: 'Housekeeping', href: '/housekeeping', icon: Brush }, // Available to all staff
  { name: 'Laundry', href: '/laundry', icon: Shirt }, // Available to all staff
  { name: 'Maintenance', href: '/maintenance', icon: Wrench }, // Available to all staff
  { name: 'Night Audit', href: '/night-audit', icon: MoonStar, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'NIGHT_AUDITOR'] },
  { name: 'Staff', href: '/staff', icon: Users, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: FileText,
    children: [
      { name: 'Shift / Cashier', href: '/reports/shift' },
      { name: 'Receivables', href: '/reports/receivables', restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'GENERAL_CASHIER'] },
      { name: 'Gateway', href: '/reports/gateway', restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'GENERAL_CASHIER'] },
      { name: 'Housekeeping', href: '/reports/housekeeping' },
      { name: 'Maintenance', href: '/reports/maintenance' },
      { name: 'Room Status', href: '/reports/room-status' },
    ]
  },
  { name: 'Cash Office', href: '/cash-office', icon: HandCoins, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'GENERAL_CASHIER'] },
  { name: 'Refunds', href: '/refunds', icon: BadgeDollarSign, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN'] },

  { name: 'Settings', href: '/settings', icon: Settings, restrictedTo: ['CEO', 'SUPER_ADMIN', 'MANAGER'] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();

  const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const userInitials = session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : '??';
  
  const role = (session?.user as any)?.role || 'STAFF';
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;

  const navigation = ALL_NAV
    .filter(item => {
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
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow shadow-blue-500/30">
          <Hotel className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">LodgeCore PMS</span>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          
          return (
            <div key={item.name}>
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
                  {session?.user?.email ?? 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(session?.user as any)?.isSuperAdmin ? 'Super Admin' : 'Staff'}
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
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r shadow-xl flex flex-col">
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
        <main className="flex-1 overflow-y-auto pb-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

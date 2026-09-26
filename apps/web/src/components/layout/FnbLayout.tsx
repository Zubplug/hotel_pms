'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import {
  LogOut,
  ChevronDown,
  Utensils,
  LayoutDashboard,
  ClipboardList,
  ReceiptText,
  ArrowLeftRight,
  Users,
  CalendarDays,
  CalendarRange,
  FileCheck2,
  LayoutGrid,
  MapPinned,
  Package,
  TrendingUp,
  Settings,
  Menu,
  X,
  ChefHat,
  ShoppingCart,
  Truck,
  ShieldCheck,
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


const FNB_NAV = [
  {
    name: 'F&B Operations',
    icon: Utensils,
    children: [
      { name: 'Sales & Analytics', href: '/fnb/dashboard', icon: LayoutDashboard },
      { name: 'Live Orders', href: '/fnb/orders', icon: ClipboardList },
      { name: 'Kitchen (KDS)', href: '/fnb/kitchen', icon: ChefHat },
      { name: 'Menu', href: '/fnb/menu', icon: Utensils },
    ],
  },
  {
    name: 'Inventory & Procurement',
    icon: ReceiptText,
    children: [
      { name: 'Inventory & AvT', href: '/fnb/inventory', icon: ReceiptText },
      { name: 'Purchasing (POs)', href: '/fnb/purchasing', icon: ShoppingCart },
      { name: 'Receiving (GRN)', href: '/fnb/purchasing/receiving', icon: Truck },
      { name: 'Requisitions', href: '/fnb/requisitions', icon: ArrowLeftRight },
      { name: 'Waste Log', href: '/fnb/inventory/waste', icon: ClipboardList },
    ],
  },
  {
    name: 'Hall Management',
    icon: LayoutGrid,
    children: [
      { name: 'Halls & Spaces', href: '/fnb/events/halls', icon: MapPinned },
      { name: 'Packages & Equipment', href: '/fnb/events/packages', icon: Package },
    ],
  },
  {
    name: 'Event Management',
    icon: CalendarDays,
    children: [
      { name: 'Events Overview', href: '/fnb/events', icon: LayoutDashboard },
      { name: 'Event Register', href: '/fnb/events/bookings', icon: ClipboardList, activeWhen: 'register' },
      { name: 'Event Schedule', href: '/fnb/events/bookings?view=timeline', icon: CalendarRange, activeWhen: 'timeline' },
      { name: 'New Booking', href: '/fnb/events/bookings/create', icon: CalendarDays },
      { name: 'Event CRM', href: '/fnb/events/crm', icon: Users },
      { name: 'BEO & Accounting', href: '/fnb/events/accounting', icon: FileCheck2 },
    ],
  },
  {
    name: 'Management & Controls',
    icon: Settings,
    children: [
      { name: 'Audit & Controls', href: '/fnb/controls', icon: ShieldCheck },
      { name: 'Staff Performance', href: '/fnb/staff', icon: Users },
      { name: 'Reports (DSS)', href: '/fnb/reports', icon: TrendingUp },
      { name: 'Settings', href: '/fnb/settings', icon: Settings },
    ],
  }
];

export function FnbLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasMultipleProperties, setHasMultipleProperties] = useState(true);
  const [timelineView, setTimelineView] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    setTimelineView(new URLSearchParams(window.location.search).get('view') === 'timeline');
  }, [pathname]);

  const sessionUser = session?.user as any;
  const userFullName = sessionUser?.firstName && sessionUser?.lastName
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : sessionUser?.staffName && sessionUser.staffName !== sessionUser.email
      ? sessionUser.staffName
      : sessionUser?.displayName && sessionUser.displayName !== sessionUser.email
        ? sessionUser.displayName
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
          <div className="h-10 w-10 rounded-full border-[3px] border-orange-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide">Loading F&B Workspace…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-[#1a1311]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-900/40">
          <Utensils className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-white tracking-tight">LodgeCore PMS</span>
          <span className="text-[10px] font-medium text-orange-400 tracking-widest uppercase">F&B & Events</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5 gap-6">
        {FNB_NAV.map((section) => (
          <div key={section.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-3 mb-1">
              <section.icon className="h-3.5 w-3.5 text-slate-500" />
              <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">
                {section.name}
              </h3>
            </div>
            {section.children.map((item) => {
              const isTimeline = item.activeWhen === 'timeline';
              const isRegister = item.activeWhen === 'register';
              const isActive = isTimeline
                ? pathname === '/fnb/events/bookings' && timelineView
                : isRegister
                  ? pathname === '/fnb/events/bookings' && !timelineView
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-orange-600 text-white shadow-sm shadow-orange-900/50'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white font-semibold text-xs ring-2 ring-orange-500/30">
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
            <DropdownMenuItem onClick={() => router.push('/general-manager')}>
              Main Dashboard
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
    <div className="flex h-screen bg-[#07111f] text-slate-100 font-sans overflow-hidden">
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
        {/* Top header - Conditionally hidden for single property to improve UI */}
        {hasMultipleProperties ? (
          <header className="h-14 shrink-0 border-b border-white/[0.08] bg-[#0b1628] flex items-center px-4 justify-between sticky top-0 z-30 shadow-sm shadow-black/20">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
            </div>
          </header>
        ) : (
          <div className="lg:hidden h-14 shrink-0 flex items-center px-4 sticky top-0 z-30 bg-[#07111f]">
            {/* Mobile menu button when header is hidden */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/10 bg-[#101b2f] text-slate-300 backdrop-blur-sm hover:bg-white/10 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            {/* We still mount PropertySelector hidden so it fires onMultiplePropertiesChange */}
            <div className="hidden">
              <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-[#07111f]">
          <div className="p-6 max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

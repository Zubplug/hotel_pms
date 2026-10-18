'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import {
  Users,
  LayoutDashboard,
  Building2,
  Briefcase,
  UserCheck,
  CalendarCheck2,
  Clock,
  CalendarRange,
  Calculator,
  Receipt,
  FileText,
  AlertTriangle,
  GraduationCap,
  Award,
  ShieldCheck,
  LifeBuoy,
  BarChart3,
  Settings,
  User,
  Search,
  Plus,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Command,
  BadgePercent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PropertySelector } from '@/components/properties/PropertySelector';
import { AppSwitcher } from '@/components/layout/AppSwitcher';

export interface HrNavItem {
  name: string;
  href: string;
  icon?: any;
  badge?: string;
  cap?: string[];
}

export interface HrNavSection {
  name: string;
  icon: any;
  children: HrNavItem[];
}

export const HR_NAVIGATION: HrNavSection[] = [
  {
    name: 'Workforce',
    icon: Users,
    children: [
      { name: 'HR Dashboard', href: '/hr', icon: LayoutDashboard },
      { name: 'Employee Directory', href: '/hr/employees', icon: Users },
      { name: 'Organization Structure', href: '/hr/organization', icon: Building2 },
      { name: 'Employee Change Requests', href: '/hr/profile-change-requests', icon: UserCheck },
    ],
  },
  {
    name: 'Time & Attendance',
    icon: Clock,
    children: [
      { name: 'Shift Scheduling', href: '/hr/shift-planning', icon: CalendarRange },
      { name: 'Attendance Register', href: '/hr/attendance', icon: Clock },
      { name: 'Leave Management', href: '/hr/leave', icon: CalendarCheck2 },
      { name: 'Missed Punch Requests', href: '/hr/attendance/missed-punch', icon: AlertTriangle },
      { name: 'Shift Swap Requests', href: '/hr/shift-planning/swaps', icon: CalendarRange },
    ],
  },
  {
    name: 'Payroll & Compensation',
    icon: Calculator,
    children: [
      { name: 'Payroll Runs', href: '/hr/payroll', icon: Calculator },
      { name: 'Loans & Advances', href: '/hr/benefits', icon: Receipt },
      { name: 'Expense Claims', href: '/hr/expenses', icon: FileText },
      { name: 'Staff Referrals', href: '/hr/referral', icon: BadgePercent },
    ],
  },
  {
    name: 'Talent & Development',
    icon: Award,
    children: [
      { name: 'Recruitment (ATS)', href: '/hr/recruitment', icon: Briefcase },
      { name: 'Onboarding & Exits', href: '/hr/onboarding', icon: UserCheck },
      { name: 'Performance & KPIs', href: '/hr/performance', icon: Award },
      { name: 'Training & Skills', href: '/hr/training', icon: GraduationCap },
    ],
  },
  {
    name: 'Governance & Records',
    icon: ShieldCheck,
    children: [
      { name: 'Employee Documents', href: '/hr/documents', icon: FileText },
      { name: 'Disciplinary Cases', href: '/hr/disciplinary', icon: AlertTriangle },
      { name: 'HR Service Desk', href: '/hr/service-desk', icon: LifeBuoy },
      { name: 'Company Policies', href: '/hr/policies', icon: ShieldCheck },
      { name: 'Statutory Remittances', href: '/hr/remittances', icon: Receipt },
      { name: 'Analytics & Reports', href: '/hr/reports', icon: BarChart3 },
      { name: 'HR Settings', href: '/hr/settings', icon: Settings },
    ],
  },
  {
    name: 'Employee Portal',
    icon: User,
    children: [
      { name: 'My Self-Service', href: '/hr/self-service', icon: User },
    ],
  },
];

export function HrLayout({
  children,
  enabledModules = ['MODULE_ENTERPRISE', 'MODULE_OPERATIONS', 'MODULE_PMS'],
}: {
  children: React.ReactNode;
  enabledModules?: readonly string[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useLodgeCoreSession();
  const logout = useLogout();

  // Keyboard shortcut Cmd+K or Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle instant search when query changes
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/hr/employees?search=${encodeURIComponent(searchQuery)}&limit=6`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.employees || []);
        }
      } catch (err) {
        console.error('Failed to search employees', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const userFullName = session?.user?.name?.trim() || 'Staff member';
  const userInitials =
    userFullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('') || 'HR';

  const userRole = String((session?.user as any)?.role || 'HR_MANAGER').replace(/_/g, ' ');

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-teal-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide font-medium">Loading HR & Payroll workspace…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-[#080d16] border-r border-slate-800/80">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-800/60 bg-[#060a12]">
        <Link href="/hr" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-600 shadow-md shadow-teal-900/40 group-hover:scale-105 transition-transform">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-wide text-white flex items-center gap-1.5">
              LodgeCore
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                HR
              </span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wider">People &amp; Payroll</span>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 custom-scrollbar">
        {HR_NAVIGATION.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <section.icon className="h-3.5 w-3.5 text-slate-500" />
              <span>{section.name}</span>
            </div>
            <div className="space-y-0.5 pt-1">
              {section.children.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/hr' && pathname?.startsWith(item.href));
                const Icon = item.icon || Users;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-300 font-semibold border-l-2 border-teal-400 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">
                        {item.badge}
                      </span>
                    )}
                    {isActive && !item.badge && (
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Card */}
      <div className="border-t border-slate-800/80 bg-[#060a12] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-3 rounded-xl hover:bg-slate-800/60 px-2 py-2 h-auto outline-none transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
                {userInitials}
              </div>
              <div className="flex flex-col items-start min-w-0 text-left">
                <span className="text-xs font-semibold text-slate-200 truncate w-full">
                  {userFullName}
                </span>
                <span className="text-[10px] text-teal-400/90 font-medium tracking-wide truncate w-full">
                  {userRole}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl border-slate-800 bg-[#0b1120] text-slate-200 shadow-xl"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">My Account</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => router.push('/hr/self-service')}
              className="cursor-pointer text-xs"
            >
              <User className="mr-2 h-4 w-4 text-teal-400" />
              Employee Self-Service
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/hr/settings')}
              className="cursor-pointer text-xs"
            >
              <Settings className="mr-2 h-4 w-4 text-slate-400" />
              HR &amp; Tax Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-400 cursor-pointer rounded-lg text-xs"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const getPageTitle = () => {
    if (pathname === '/hr') return 'HR & Payroll Overview';
    for (const group of HR_NAVIGATION) {
      const found = group.children.find((c) => c.href === pathname || (c.href !== '/hr' && pathname.startsWith(c.href)));
      if (found) return found.name;
    }
    return pathname.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') || 'HR Workspace';
  };

  return (
    <div className="hr-shell flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-[#080d16] shadow-2xl animate-in slide-in-from-left duration-200">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 text-slate-400 hover:text-white z-50"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#070c14]/95 px-4 backdrop-blur sm:px-6 lg:h-16">
          {/* Left: Mobile Toggle & Breadcrumb */}
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-9 w-9 shrink-0 border-slate-700/60 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 lg:hidden"
              aria-label="Open HR navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-400">
                  Human Resources &amp; Payroll
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">Enterprise Suite</span>
              </div>
              <h1 className="truncate text-sm font-semibold capitalize text-slate-100 lg:text-base">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          {/* Right: Quick Search, Quick Actions, Property Selector, AppSwitcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors text-xs"
              title="Search Employees (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Quick Search…</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 text-[9px] text-slate-400">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </button>

            {/* Quick Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs h-8 px-2.5 sm:px-3 gap-1 shadow-sm shadow-teal-950 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Action</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border-slate-800 bg-[#0b1120] text-slate-200 shadow-xl"
              >
                <DropdownMenuLabel className="text-xs text-slate-400">Quick HR Operations</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => router.push('/hr/employees?action=new')}
                  className="cursor-pointer text-xs"
                >
                  <Users className="w-4 h-4 mr-2 text-teal-400" />
                  Add Employee
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/hr/leave?action=new')}
                  className="cursor-pointer text-xs"
                >
                  <CalendarCheck2 className="w-4 h-4 mr-2 text-amber-400" />
                  Submit Leave Request
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/hr/shift-planning?action=new')}
                  className="cursor-pointer text-xs"
                >
                  <CalendarRange className="w-4 h-4 mr-2 text-indigo-400" />
                  Assign Shift Roster
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/hr/payroll?action=new')}
                  className="cursor-pointer text-xs"
                >
                  <Calculator className="w-4 h-4 mr-2 text-emerald-400" />
                  Launch Payroll Batch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Property Selector */}
            <PropertySelector className="max-w-[130px] sm:max-w-[200px]" />

            {/* Module Switcher */}
            <AppSwitcher enabledModules={enabledModules} />
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>

      {/* Global Employee Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-400" />
              <DialogTitle className="text-sm font-semibold">Search Employees &amp; Records</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-4">
            <Input
              autoFocus
              placeholder="Search by name, employee code, email, or department…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-teal-500 text-sm"
            />

            <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
              {searching && (
                <div className="py-6 text-center text-xs text-slate-400">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mr-2" />
                  Searching employee registry…
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((emp) => (
                    <Link
                      key={emp.id}
                      href={`/hr/employees?id=${emp.id}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center text-xs font-semibold">
                          {emp.name?.slice(0, 2).toUpperCase() || 'EM'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-100">{emp.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {emp.employeeCode || emp.id.slice(0, 8)} • {emp.department?.name || 'General'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {emp.profile?.employmentStatus || emp.status || 'ACTIVE'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">
                  No employee records found matching &ldquo;{searchQuery}&rdquo;.
                </p>
              )}

              {!searching && searchQuery.length < 2 && (
                <div className="py-4 text-center text-xs text-slate-500">
                  Type at least 2 characters to search employees across departments.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

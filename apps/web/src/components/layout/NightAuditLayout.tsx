'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Hotel, Menu, MoonStar, Clock, FileText, LogOut, ChevronDown,
  ShieldCheck, BedDouble, Scale, Wallet, Banknote,
  X, ChevronRight, Radio, Zap, Utensils, PanelLeftClose, PanelLeftOpen,
  Search, Bell, Settings, User, ChevronLeft, RefreshCw
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from 'next-auth/react';
import { useLogout } from '@/hooks/useLogout';
import { PropertySelector } from '@/components/properties/PropertySelector';
import { useProperty } from '@/components/PropertyProvider';

const SIDEBAR_EXPANDED_KEY = 'na_sidebar_expanded';

const NIGHT_AUDIT_NAV = [
  {
    name: 'Audit Overview',
    href: '/night-audit',
    icon: MoonStar,
    group: 'Workspace',
    description: 'Main night audit dashboard',
  },
  {
    name: 'Audit History',
    href: '/night-audit/history',
    icon: Clock,
    group: 'Workspace',
    description: 'View past audit records',
  },
  {
    name: 'Revenue Reconciliation',
    href: '/night-audit/reconciliation',
    icon: Scale,
    group: 'Controls',
    description: 'Balance revenue across departments',
  },
  {
    name: 'Room & Guest Control',
    href: '/night-audit/rooms',
    icon: BedDouble,
    group: 'Controls',
    description: 'Room status and guest activity',
  },
  {
    name: 'F&B Activity',
    href: '/night-audit/fnb',
    icon: Utensils,
    group: 'Controls',
    description: 'Food and beverage reconciliation',
  },
  {
    name: 'AR Ledger',
    href: '/night-audit/ar-ledger',
    icon: Wallet,
    group: 'Controls',
    description: 'Accounts receivable ledger',
  },
  {
    name: 'City Ledger',
    href: '/night-audit/city-ledger',
    icon: Wallet,
    group: 'Controls',
    description: 'Corporate billing and city accounts',
  },
  {
    name: 'Corporate Management',
    href: '/night-audit/corporate',
    icon: Wallet,
    group: 'Controls',
    description: 'Corporate account management',
    roles: ['NIGHT_AUDITOR', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'SUPER_ADMIN'],
  },
  {
    name: 'Guest Credits',
    href: '/night-audit/guest-credits',
    icon: Wallet,
    group: 'Controls',
    description: 'Guest credit balances and limits',
  },
  {
    name: 'AP Ledger',
    href: '/night-audit/ap-ledger',
    icon: Banknote,
    group: 'Controls',
    description: 'Accounts payable ledger',
  },
  {
    name: 'Audit Reports',
    href: '/night-audit/reports',
    icon: FileText,
    group: 'Insights',
    description: 'Generate and view audit reports',
  },
];

const GROUPS = ['Workspace', 'Controls', 'Insights'] as const;

const GROUP_META: Record<string, { accent: string; label: string }> = {
  Workspace: { accent: 'text-amber-400/70', label: 'Workspace' },
  Controls: { accent: 'text-indigo-400/70', label: 'Controls' },
  Insights: { accent: 'text-violet-400/70', label: 'Insights' },
};

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export function NightAuditLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hasMultipleProperties, setHasMultipleProperties] = useState<boolean | null>(null);
  const [clock, setClock] = useState('');
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [shiftStart] = useState(() => Date.now());
  const [propertyLabel, setPropertyLabel] = useState('');
  const [propertyTimezone, setPropertyTimezone] = useState('');
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const logout = useLogout();
  const { propertyId } = useProperty();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Restore sidebar state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (stored !== null) setCollapsed(stored === 'false');
    } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(!next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Live clock + elapsed shift timer
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setShiftSeconds(Math.floor((Date.now() - shiftStart) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shiftStart]);

  useEffect(() => {
    let cancelled = false;
    if (!propertyId) return;
    fetch('/api/v1/properties?pageSize=100', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        const properties = Array.isArray(json?.data?.data) ? json.data.data : Array.isArray(json?.data) ? json.data : [];
        const selected = properties.find((property: any) => property.id === propertyId);
        if (!cancelled && selected) {
          setPropertyLabel(selected.name || selected.propertyName || '');
          setPropertyTimezone(selected.timezone || selected.timeZone || '');
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [propertyId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, number>>).detail || {};
      setNavBadges(detail);
    };
    window.addEventListener('night-audit:queue-counts', handler);
    return () => window.removeEventListener('night-audit:queue-counts', handler);
  }, []);

  const userDisplay = session?.user?.name || session?.user?.email || 'Staff member';
  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (session?.user?.email ? session.user.email.substring(0, 2).toUpperCase() : '??');
  const role = (session?.user as any)?.role || 'STAFF';
  const roleLabel =
    role === 'MANAGER' ? 'Night Manager' :
    role === 'GENERAL_CASHIER' ? 'General Cashier' :
    role === 'GENERAL_MANAGER' ? 'General Manager' :
    'Night Auditor';

  // Breadcrumb from pathname
  const crumbs = pathname.split('/').filter(Boolean);
  const currentPageName = crumbs.length > 1
    ? crumbs[crumbs.length - 1].replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Audit Overview';

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#050a14' }}>
        <div className="flex flex-col items-center gap-5">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 0 80px rgba(99,102,241,0.2)',
            }}
          >
            <MoonStar className="h-7 w-7 text-white" />
            <span
              className="absolute inset-0 rounded-2xl animate-ping"
              style={{ background: 'rgba(99,102,241,0.3)' }}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">Loading Night Audit</p>
            <p className="mt-1 text-xs text-slate-600">Authenticating your session…</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  /* ─── Sidebar nav item ─────────────────────────────────────────────────── */
  const NavItem = ({
    item,
    onNavigate,
  }: {
    item: typeof NIGHT_AUDIT_NAV[number];
    onNavigate?: () => void;
  }) => {
    const isActive = pathname === item.href || (item.href !== '/night-audit' && pathname.startsWith(`${item.href}/`));
    const Icon = item.icon;

    return (
      <div className="relative group/item">
        <Link
          href={item.href}
          onClick={onNavigate}
          title={collapsed ? item.name : undefined}
          className={cn(
            'relative flex items-center gap-3 overflow-hidden transition-all duration-200',
            collapsed ? 'justify-center rounded-xl p-2.5 mx-1' : 'rounded-xl px-3 py-2.5',
            isActive
              ? 'text-white'
              : 'text-slate-500 hover:text-slate-200',
          )}
          style={isActive ? {
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)',
          } : undefined}
        >
          {/* Hover background */}
          {!isActive && (
            <span className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover/item:opacity-100"
              style={{ background: 'rgba(255,255,255,0.04)' }} />
          )}

          {/* Active left bar */}
          {isActive && !collapsed && (
            <span
              className="absolute inset-y-[8px] left-0 w-[3px] rounded-full"
              style={{
                background: 'linear-gradient(180deg, #f59e0b, #d97706)',
                boxShadow: '0 0 12px rgba(245,158,11,0.8)',
              }}
            />
          )}

          {/* Icon */}
          <span
            className={cn(
              'relative z-10 flex shrink-0 items-center justify-center rounded-lg border transition-all duration-200',
              collapsed ? 'h-8 w-8' : 'h-7 w-7',
              isActive
                ? 'border-amber-400/30 bg-amber-400/15 text-amber-300'
                : 'border-transparent text-slate-500 group-hover/item:border-white/[0.07] group-hover/item:bg-white/[0.05] group-hover/item:text-slate-300',
            )}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>

          {/* Label (hidden when collapsed) */}
          {!collapsed && (
            <span className="relative z-10 flex-1 text-[13px] font-medium leading-none">
              {item.name}
            </span>
          )}

          {navBadges[item.href] > 0 && (
            <span className="relative z-10 min-w-5 rounded-full border border-rose-400/30 bg-rose-400/15 px-1.5 py-0.5 text-center text-[9px] font-bold text-rose-300">
              {navBadges[item.href] > 99 ? '99+' : navBadges[item.href]}
            </span>
          )}

          {!collapsed && isActive && (
            <ChevronRight className="relative z-10 h-3.5 w-3.5 text-amber-400/60" />
          )}
        </Link>

        {/* Tooltip for collapsed mode */}
        {collapsed && (
          <div
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-xl border border-white/[0.1] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-2xl transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0 translate-x-[-4px] whitespace-nowrap"
            style={{ background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(12px)' }}
          >
            {item.name}
            <p className="mt-0.5 text-[10px] font-normal text-slate-500">{item.description}</p>
          </div>
        )}
      </div>
    );
  };

  /* ─── Sidebar content ───────────────────────────────────────────────────── */
  const renderSidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #07090f 0%, #080b14 100%)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-indigo-600/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-violet-700/8 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-8 h-32 w-32 rounded-full bg-amber-500/5 blur-2xl" />

      {/* ── Logo bar ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative flex shrink-0 items-center border-b border-white/[0.06] transition-all duration-300',
          collapsed ? 'h-[64px] justify-center px-0' : 'h-[64px] gap-3 px-5',
        )}
      >
        <Link
          href="/night-audit"
          onClick={onNavigate}
          className="group flex items-center gap-3"
        >
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/15 transition-all duration-300 group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d97706 100%)',
              boxShadow: '0 0 20px rgba(99,102,241,0.4), 0 0 40px rgba(99,102,241,0.15)',
            }}
          >
            <span className="pointer-events-none absolute -inset-1 rounded-[14px] border border-violet-400/30 opacity-70 animate-[spin_8s_linear_infinite]" />
            <Hotel className="h-4 w-4 text-white" strokeWidth={1.8} />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-white">LodgeCore</span>
              <span className="ml-1 inline-flex w-fit rounded border border-cyan-400/25 bg-cyan-400/10 px-1 py-0.5 text-[8px] font-bold text-cyan-300">v2</span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-amber-400/70">Night Audit</span>
            </div>
          )}
        </Link>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="relative px-4 pt-4">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-3.5"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(217,119,6,0.05) 100%)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                </span>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Live Session</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                <Radio className="h-2 w-2" />
                LIVE
              </span>
            </div>

            <div className="mt-3 border-t border-white/[0.06] pt-3">
              {propertyLabel && <p className="truncate text-[10px] font-semibold text-slate-300">{propertyLabel}</p>}
              {propertyTimezone && <p className="mt-0.5 text-[9px] text-cyan-300/70">{propertyTimezone}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-slate-600">Current time</p>
                <p className="font-mono text-[11px] font-bold tabular-nums text-indigo-300">{clock}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-600">Shift elapsed</p>
                <p className="font-mono text-[11px] font-bold tabular-nums text-amber-400/80">{formatElapsed(shiftSeconds)}</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className={cn(
        'relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        collapsed ? 'py-4' : 'px-2 py-4',
      )}>
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => {
            const items = NIGHT_AUDIT_NAV.filter(
              (i) => i.group === group && (!(i as any).roles || (i as any).roles.includes(role))
            );
            if (!items.length) return null;
            const meta = GROUP_META[group];
            return (
              <div key={group}>
                {!collapsed && (
                  <p className={cn('mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.22em]', meta.accent)}>
                    {meta.label}
                  </p>
                )}
                {collapsed && (
                  <div className="mx-2 mb-2 border-t border-white/[0.05]" />
                )}
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <NavItem key={item.href} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Collapse toggle ───────────────────────────────────────────────── */}
      <div className="relative shrink-0 border-t border-white/[0.06] p-2">
        <button
          onClick={toggleCollapsed}
          className={cn(
            'group flex items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2.5 text-xs font-semibold text-slate-500 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-slate-300',
            collapsed ? 'w-full justify-center px-0' : 'w-full',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse sidebar</span>
              </>
            )
          }
        </button>
      </div>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className={cn('relative shrink-0 border-t border-white/[0.06] p-3', collapsed && 'flex justify-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.07] outline-none transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]',
              collapsed ? 'p-2' : 'w-full px-3 py-3',
            )}
          >
            {/* Avatar */}
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ring-1 ring-white/10 transition-all duration-200 group-hover:ring-amber-400/40"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {userInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[2px] bg-emerald-400"
                style={{ borderColor: '#07090f' }}
              />
            </div>

            {!collapsed && (
              <>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="w-full truncate text-left text-[13px] font-semibold text-slate-200 transition-colors group-hover:text-white">
                    {userDisplay}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400/70 transition-colors group-hover:text-amber-400">
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={collapsed ? 'center' : 'start'}
            side="top"
            sideOffset={10}
            className="w-[240px] rounded-xl border border-white/[0.08] p-1.5 shadow-2xl"
            style={{ background: '#0f1525' }}
          >
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">{userDisplay}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{roleLabel}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.07]" />
            <DropdownMenuItem onClick={() => router.push('/profile')} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 focus:bg-white/[0.06]">
              <User className="h-4 w-4" /><span className="text-sm font-medium">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 focus:bg-white/[0.06]">
              <Settings className="h-4 w-4" /><span className="text-sm font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => logout()}
              className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-rose-400 transition-colors hover:bg-rose-400/10 focus:bg-rose-400/10 focus:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  /* ─── Page shell ────────────────────────────────────────────────────────── */
  const sidebarWidth = collapsed ? 72 : 260;

  return (
    <div
      className="flex h-screen overflow-hidden font-sans print:block print:h-auto print:overflow-visible print:bg-white"
      style={{ background: '#050a14' }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 flex w-[260px] flex-col shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              style={{ background: '#07090f' }}
            >
              <X className="h-4 w-4" />
            </button>
            {renderSidebarContent({ onNavigate: () => setSidebarOpen(false) })}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.05] shadow-[12px_0_48px_rgba(0,0,0,0.6)] lg:flex lg:flex-col print:hidden transition-all duration-300 ease-in-out"
        style={{ width: sidebarWidth }}
      >
        {renderSidebarContent({})}
      </aside>

      {/* Main content */}
      <div
        className="flex min-w-0 flex-1 flex-col max-lg:!pl-0 print:pl-0 print:block print:w-full print:h-auto transition-all duration-300 ease-in-out"
        style={{ paddingLeft: sidebarWidth }}
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.05] px-4 sm:px-6 print:hidden"
          style={{ background: 'rgba(5,10,20,0.95)', backdropFilter: 'blur(16px)' }}
        >
          {/* Left: mobile menu + breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop collapse/expand toggle */}
            <button
              className="hidden h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-300 lg:flex"
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[11px] font-semibold text-slate-600">Night Audit</span>
              {pathname !== '/night-audit' && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-700" />
                  <span className="text-[11px] font-semibold text-slate-300 capitalize">{currentPageName}</span>
                </>
              )}
            </nav>
          </div>

          {/* Center: selected property */}
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            {propertyLabel && <span className="max-w-[360px] truncate text-xs font-semibold text-slate-300">{propertyLabel}</span>}
          </div>

          {/* Right: property selector + refresh + user chip */}
          <div className="flex items-center gap-2 sm:gap-3">
            {hasMultipleProperties !== false && (
              <PropertySelector
                className="max-w-[140px] sm:max-w-[220px]"
                onMultiplePropertiesChange={setHasMultipleProperties}
              />
            )}
            <button
              type="button"
              title="Refresh audit data"
              onClick={() => window.dispatchEvent(new Event('night-audit:refresh'))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            {/* User avatar shortcut */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white ring-1 ring-white/10"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              title={userDisplay}
            >
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto print:overflow-visible print:h-auto print:flex-none"
          style={{ background: '#050a14' }}
        >
          <div className="mx-auto max-w-screen-2xl print:max-w-none print:mx-0 print:w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

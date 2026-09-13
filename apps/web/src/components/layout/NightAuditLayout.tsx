'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Hotel, Menu, MoonStar, Clock, FileText, LogOut, ChevronDown,
  Server, ShieldCheck, BedDouble, Scale, Wallet, Banknote,
  X, ChevronRight, Radio, Zap, Utensils
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from 'next-auth/react';
import { useLogout } from '@/hooks/useLogout';
import { PropertySelector } from '@/components/properties/PropertySelector';

const NIGHT_AUDIT_NAV = [
  { name: 'Audit Overview',          href: '/night-audit',                  icon: MoonStar,    group: 'Workspace' },
  { name: 'Audit History',           href: '/night-audit/history',           icon: Clock,       group: 'Workspace' },
  { name: 'Revenue Reconciliation',  href: '/night-audit/reconciliation',    icon: Scale,       group: 'Controls'  },
  { name: 'Room & Guest Control',    href: '/night-audit/rooms',             icon: BedDouble,   group: 'Controls'  },
  { name: 'F&B Activity',            href: '/night-audit/fnb',               icon: Utensils,    group: 'Controls'  },
  { name: 'AR Ledger',               href: '/night-audit/ar-ledger',         icon: Wallet,      group: 'Controls'  },
  { name: 'AP Ledger',               href: '/night-audit/ap-ledger',         icon: Banknote,    group: 'Controls'  },
  { name: 'Audit Reports',           href: '/night-audit/reports',           icon: FileText,    group: 'Insights'  },
  { name: 'System & Sync',           href: '/night-audit/system',            icon: Server,      group: 'Insights'  },
];

const GROUPS = ['Workspace', 'Controls', 'Insights'] as const;

const GROUP_ACCENT: Record<string, string> = {
  Workspace: 'text-indigo-400',
  Controls:  'text-violet-400',
  Insights:  'text-sky-400',
};

export function NightAuditLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasMultipleProperties, setHasMultipleProperties] = useState<boolean | null>(null);
  const [clock, setClock] = useState('');
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const userDisplay = session?.user?.name || session?.user?.email || 'Staff member';
  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (session?.user?.email ? session.user.email.substring(0, 2).toUpperCase() : '??');
  const role = (session?.user as any)?.role || 'STAFF';
  const roleLabel = role === 'MANAGER' ? 'Night Manager' : role === 'GENERAL_CASHIER' ? 'General Cashier' : 'Night Auditor';

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060b18' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 0 32px rgba(99,102,241,0.4)' }}>
            <MoonStar className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm font-medium text-slate-500">Loading Night Audit…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  /* ─── Sidebar inner ─────────────────────────────────────────────────────── */
  const renderSidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="relative flex h-full min-h-0 flex-col" style={{ background: '#07090f', overflow: 'hidden' }}>

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-violet-700/10 blur-3xl" />

      {/* ── Logo bar ── */}
      <div className="relative flex h-[64px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
        <Link href="/night-audit" className="group flex items-center gap-3" onClick={onNavigate}>
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/15 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(99,102,241,0.5)]"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
          >
            <Hotel className="h-4 w-4 text-white" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-white">LodgeCore</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-indigo-400/70">Night Audit</span>
          </div>
        </Link>
      </div>

      {/* ── Status card ── */}
      <div className="relative px-4 pt-4">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-3.5"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(124,58,237,0.06) 100%)' }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Audit Control</p>
                <p className="text-xs font-semibold text-white">Night shift active</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <Radio className="h-2.5 w-2.5" />
              Live
            </span>
          </div>

          {/* Clock */}
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
            <span className="text-[10px] text-slate-600">Current time</span>
            <span className="font-mono text-[12px] font-bold tabular-nums text-indigo-300">{clock}</span>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="relative min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-5 pb-12 flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GROUPS.map((group) => {
          const items = NIGHT_AUDIT_NAV.filter(i => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className={cn('mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.22em]', GROUP_ACCENT[group])}>
                {group}
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                        isActive ? 'text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                      )}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(124,58,237,0.10) 100%)',
                      } : undefined}
                    >
                      {/* Active left glow bar */}
                      {isActive && (
                        <span
                          className="absolute inset-y-[10px] left-0 w-[3px] rounded-full"
                          style={{ background: 'linear-gradient(180deg, #818cf8, #a78bfa)', boxShadow: '0 0 10px rgba(129,140,248,0.8)' }}
                        />
                      )}

                      {/* Icon */}
                      <span className={cn(
                        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-150',
                        isActive
                          ? 'border-indigo-400/30 bg-indigo-400/15 text-indigo-300'
                          : 'border-transparent text-slate-500 group-hover:border-white/[0.07] group-hover:bg-white/[0.05] group-hover:text-slate-300'
                      )}>
                        <Icon className="h-[15px] w-[15px]" />
                      </span>

                      <span className="relative z-10 flex-1">{item.name}</span>

                      {isActive && (
                        <ChevronRight className="relative z-10 h-3.5 w-3.5 text-indigo-400/60" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="relative shrink-0 border-t border-white/[0.06] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="group relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.07] px-3 py-3 outline-none transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]">
            {/* Avatar */}
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ring-1 ring-white/10 transition-all duration-200 group-hover:ring-indigo-400/40"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {userInitials}
              {/* Online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[2px] bg-emerald-400" style={{ borderColor: '#07090f' }} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-start">
              <span className="w-full truncate text-left text-[13px] font-semibold text-slate-200 transition-colors group-hover:text-white">
                {userDisplay}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400/70 transition-colors group-hover:text-indigo-300">
                {roleLabel}
              </span>
            </div>

            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={10}
            className="w-[240px] rounded-xl border border-white/[0.08] p-1.5 shadow-2xl"
            style={{ background: '#0f1525' }}
          >
            {/* User info header */}
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
  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: '#060b18' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-white/[0.06] shadow-[12px_0_48px_rgba(0,0,0,0.5)] lg:flex lg:flex-col print:hidden">
        {renderSidebarContent({})}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[260px] print:pl-0">

        {/* Top bar */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-[64px] shrink-0 items-center justify-between border-b border-white/[0.06] px-4 backdrop-blur-md sm:px-6 print:hidden',
            hasMultipleProperties === false && 'lg:hidden',
          )}
          style={{ background: 'rgba(6,11,24,0.92)' }}
        >
          {/* Mobile menu button */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            {hasMultipleProperties !== false && (
              <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto print:overflow-visible" style={{ background: '#060b18' }}>
          <div className="mx-auto max-w-screen-2xl print:max-w-none print:mx-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

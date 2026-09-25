'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useLogout } from '@/hooks/useLogout';
import { PropertySelector } from '@/components/properties/PropertySelector';
import {
  Hotel,
  LogOut,
  Key,
  AlertCircle,
  Brush,
  Wrench,
  Shirt,
  Printer,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProperty } from '@/components/PropertyProvider';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SyncIndicator } from '@/components/frontdesk/SyncIndicator';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AppSwitcher } from '@/components/layout/AppSwitcher';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { toast } from 'sonner';
import { FrontDeskMasterCardModal } from '@/components/frontdesk/FrontDeskMasterCardModal';

export function FrontDeskLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useLodgeCoreSession();
  const { propertyId } = useProperty();
  const { provider, isOnline, isDesktopMode } = useLodgeCoreProvider();
  const logout = useLogout();
  const router = useRouter();
  const [time, setTime] = useState<Date | null>(null);
  const [showMasterCardModal, setShowMasterCardModal] = useState(false);

  const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

  useEffect(() => {
    if (status === 'unauthenticated') logout();
  }, [status, logout]);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add('frontdesk-dark-surface');
    return () => document.body.classList.remove('frontdesk-dark-surface');
  }, []);

  const { data: res } = useQuery({
    queryKey: ['frontdesk', 'dashboard', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      return provider.dashboard.get(propertyId);
    },
    enabled: !!propertyId && status === 'authenticated',
    refetchInterval: 10000,
  });

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080c18]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  const cloudHardware = res?.data?.hardware;
  const businessDate = res?.data?.businessDate ? new Date(res.data.businessDate) : null;
  const isDesktopApp = HardwareBridge.isAvailable();

  const hardwareStatus = isDesktopApp ? 'ONLINE' : (cloudHardware?.status || 'OFFLINE');
  const encoderName = isDesktopApp ? 'LodgeCore Desktop App' : (cloudHardware?.name || 'Windows Lock Agent');
  const printerStatus = isDesktopApp ? 'ONLINE' : 'OFFLINE';
  const hardwareOnline = hardwareStatus === 'ONLINE' || printerStatus === 'ONLINE';

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : session?.user?.email?.slice(0, 2).toUpperCase() ?? '??';

  const userName = session?.user?.name || session?.user?.email || 'Staff';
  const role = ((session?.user as any)?.role || 'STAFF').toUpperCase();
  const roleLabel = role.toLowerCase().replace(/_/g, ' ');

  const navLinks = [
    { href: '/frontdesk/refunds', label: 'Refunds' },
    { href: '/frontdesk/cashier', label: 'Cashier Shift' },
    { href: '/laundry', label: 'Laundry', icon: Shirt },
    { href: '/frontdesk/housekeeping', label: 'Housekeeping', icon: Brush },
    { href: '/frontdesk/maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <div className="frontdesk-dark-surface flex min-h-screen flex-col bg-[#080c18]">
      <FrontDeskMasterCardModal isOpen={showMasterCardModal} onClose={() => setShowMasterCardModal(false)} />

      {/* ── Top App Bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full flex items-center h-[60px] px-4 md:px-6 bg-[#080c18]/90 backdrop-blur-xl border-b border-white/[0.06]">

        {/* Left: Switcher · Logo · Property · Nav */}
        <div className="flex items-center gap-4 lg:gap-5 flex-1 min-w-0">
          {!isDesktop && <AppSwitcher />}

          <Link href="/frontdesk" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_0_16px_-4px_rgba(99,102,241,0.6)] transition-all group-hover:shadow-[0_0_20px_-4px_rgba(99,102,241,0.8)] group-hover:scale-105">
              <Hotel className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white hidden sm:inline-block">LodgeCore</span>
          </Link>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Property */}
          {role !== 'RECEPTIONIST' ? (
            <PropertySelector className="w-[180px] lg:w-[220px]" />
          ) : (
            <div className="flex items-center">
              <div className="hidden"><PropertySelector /></div>
              {res?.data?.property?.name ? (
                <span className="text-sm font-semibold text-slate-300 whitespace-nowrap tracking-tight">
                  {res.data.property.name}
                </span>
              ) : (
                <div className="h-4 w-28 bg-white/10 animate-pulse rounded" />
              )}
            </div>
          )}

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Clock · Hardware · Sync · User */}
        <div className="flex items-center gap-3 lg:gap-4 shrink-0 ml-auto">

          {/* Clock */}
          <div className="hidden xl:flex flex-col items-end">
            {businessDate ? (
              <span className="text-[11px] font-bold text-slate-300 leading-tight">
                {businessDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            ) : (
              <div className="h-3 w-24 bg-white/10 animate-pulse rounded" />
            )}
            <span className="text-[11px] text-slate-500 font-mono">
              {time ? time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--:--'}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden lg:block" />

          {/* Hardware status */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <button className={cn(
                'flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-bold border transition-all',
                hardwareOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
                  : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15',
              )}>
                {hardwareOnline ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="hidden sm:inline">Hardware Ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-[#0d1424] border border-white/10 text-slate-200 rounded-2xl shadow-2xl p-2">
              <DropdownMenuLabel className="text-slate-400 text-xs uppercase tracking-wider font-bold px-2 pt-1">Hardware Status</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10 my-2" />
              <div className="px-2 py-2 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <Hotel className="w-4 h-4 text-slate-500" />
                    Lock Encoder
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    hardwareStatus === 'ONLINE'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/15 text-red-400 border-red-500/20'
                  )}>
                    {hardwareStatus === 'ONLINE' ? 'READY' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 ml-6">{encoderName}</p>

                <div className="flex justify-between items-center pt-2 border-t border-white/8">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <Printer className="w-4 h-4 text-slate-500" />
                    Receipt Printer
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    printerStatus === 'ONLINE'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/15 text-red-400 border-red-500/20'
                  )}>
                    {printerStatus === 'ONLINE' ? 'READY' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 ml-6">ESC/POS Thermal Printer</p>

                <button
                  onClick={() => router.push('/frontdesk/hardware-settings')}
                  className="w-full mt-1 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Configure Hardware
                </button>

                {cloudHardware?.message && !isDesktopApp && (
                  <p className="text-xs text-slate-500 bg-white/5 rounded-lg p-2">{cloudHardware.message}</p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sync Now (desktop only) */}
          {isDesktopMode && (
            <button
              className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-400 hover:text-slate-300 transition-all"
              onClick={async () => {
                try {
                  if (provider.system?.forceSync) {
                    toast.promise(provider.system.forceSync(), {
                      loading: 'Synchronizing with cloud…',
                      success: 'Sync completed',
                      error: 'Sync failed. Check connection.',
                    });
                  }
                } catch (e) {}
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Now
            </button>
          )}

          {/* Offline sync indicator */}
          <SyncIndicator />

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-xs font-bold text-white hover:border-white/20 hover:from-indigo-500/40 hover:to-violet-500/40 transition-all cursor-pointer shadow-[0_0_12px_-4px_rgba(99,102,241,0.3)]">
                {userInitials}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#0d1424] border border-white/10 text-slate-200 rounded-2xl shadow-2xl mt-1 p-2">
              <div className="px-2 py-2 mb-1">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{roleLabel}</p>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => setShowMasterCardModal(true)}
                className="cursor-pointer font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl my-0.5 focus:bg-indigo-500/10 focus:text-indigo-300"
              >
                <Key className="mr-2 h-4 w-4" />
                Create Master Card
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl focus:bg-red-500/10 focus:text-red-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline Mode — Showing local operational cache. Actions will be synced when connection is restored.</span>
        </div>
      )}

      {/* Content */}
      <main className="frontdesk-dark-surface flex-1 overflow-x-hidden bg-[#080c18]">
        {children}
      </main>
    </div>
  );
}

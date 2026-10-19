'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { TerminalAuthScreen } from '@/components/pos/TerminalAuthScreen';
import {
  Waves, Ticket, ScanLine, Users, LayoutGrid,
  ShieldCheck, BarChart3, Clock, Settings2, ScrollText,
  AlertTriangle, ChevronDown, RefreshCw, WifiOff, Wifi,
  LogOut, ChevronLeft, Menu, X, ShoppingCart,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  exact?: boolean;
}

interface FacilitySummary {
  id: string;
  name: string;
  status: string;
  capacity: number;
}

interface PoolShellData {
  businessDate: string;
  currency: string;
  facility: FacilitySummary | null;
  facilities: FacilitySummary[];
  metrics: { occupancy: number; capacity: number; incidents: number };
}

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/pos/swimming-pool', icon: Waves, exact: true },
  { label: 'Admissions', href: '/pos/swimming-pool/admissions', icon: Ticket },
  { label: 'Check-In / Out', href: '/pos/swimming-pool/check-in', icon: ScanLine },
  { label: 'Occupancy', href: '/pos/swimming-pool/occupancy', icon: Users },
  { label: 'Resources', href: '/pos/swimming-pool/resources', icon: LayoutGrid },
  { label: 'Safety & Incidents', href: '/pos/swimming-pool/safety', icon: ShieldCheck },
  { label: 'Reports', href: '/pos/swimming-pool/reports', icon: BarChart3 },
  { label: 'Shift', href: '/pos/swimming-pool/shift', icon: Clock },
  { label: 'Settings', href: '/pos/swimming-pool/settings', icon: Settings2 },
  { label: 'Audit Trail', href: '/pos/swimming-pool/audit', icon: ScrollText },
];

function facilityStatusColour(status: string) {
  switch (status) {
    case 'OPEN': return '#10b981';
    case 'CLOSED': return '#ef4444';
    case 'MAINTENANCE': return '#f59e0b';
    case 'WEATHER_HOLD': return '#f59e0b';
    default: return '#64748b';
  }
}

// ─── Sync Status Indicator ────────────────────────────────────────────────────

function SyncStatusChip() {
  const [online, setOnline] = useState(true);
  const [pendingOps, setPendingOps] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // Try to read desktop sync state if available
    const readDesktopSync = () => {
      try {
        const raw = localStorage.getItem('lc_sync_pending_count');
        setPendingOps(raw ? Number(raw) : 0);
      } catch {
        setPendingOps(0);
      }
    };
    readDesktopSync();
    const interval = setInterval(readDesktopSync, 8000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, []);

  if (!online) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30">
        <WifiOff className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Offline</span>
      </div>
    );
  }

  if (pendingOps > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-500/15 border border-sky-500/30">
        <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
          {pendingOps} pending
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
      <Wifi className="w-3 h-3 text-emerald-400" />
      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Live</span>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  shellData: PoolShellData | null;
  collapsed: boolean;
  incidentCount: number;
  onFacilityChange: (id: string) => void;
  onLogout: () => void;
  userDisplayName: string;
  userInitials: string;
}

function Sidebar({ shellData, collapsed, incidentCount, onFacilityChange, onLogout, userDisplayName, userInitials }: SidebarProps) {
  const pathname = usePathname();
  const [facilityOpen, setFacilityOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <aside
      className="flex flex-col border-r shrink-0 overflow-y-auto overflow-x-hidden"
      style={{
        width: collapsed ? 56 : 200,
        background: '#060b13',
        borderColor: 'rgba(255,255,255,0.08)',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,189,248,0.18)' }}>
          <Waves className="w-4 h-4" style={{ color: '#38bdf8' }} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>Pool Terminal</p>
            <p className="text-[10px]" style={{ color: '#475569' }}>LodgeCore PMS</p>
          </div>
        )}
      </div>

      {/* Facility selector */}
      {!collapsed && shellData && shellData.facilities.length > 0 && (
        <div className="px-2.5 pt-3 pb-1 shrink-0">
          <button
            onClick={() => setFacilityOpen(!facilityOpen)}
            className="w-full flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: shellData.facility ? facilityStatusColour(shellData.facility.status) : '#64748b' }}
              />
              <span className="truncate text-[11px]">{shellData.facility?.name ?? 'No facility'}</span>
            </div>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${facilityOpen ? 'rotate-180' : ''}`} />
          </button>
          {facilityOpen && shellData.facilities.length > 1 && (
            <div className="mt-1 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {shellData.facilities.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { onFacilityChange(f.id); setFacilityOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors hover:bg-white/5"
                  style={{ color: shellData.facility?.id === f.id ? '#38bdf8' : '#94a3b8' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: facilityStatusColour(f.status) }} />
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        <Link
          href="/pos"
          title={collapsed ? 'POS Terminal' : undefined}
          className="pool-nav-link"
          style={collapsed ? { justifyContent: 'center', padding: '0.5rem' } : {}}
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">POS Terminal</span>}
        </Link>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge = item.label === 'Safety & Incidents' ? incidentCount : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`pool-nav-link ${active ? 'active' : ''}`}
              style={collapsed ? { justifyContent: 'center', padding: '0.5rem' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && badge && badge > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(244,63,94,0.20)', color: '#fda4af' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer — user identity + logout */}
      <div className="px-2.5 py-3 border-t shrink-0 space-y-1" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black"
              style={{ background: 'rgba(56,189,248,0.18)', color: '#38bdf8' }}
            >
              {userInitials}
            </div>
            <p className="text-[11px] font-semibold text-white truncate flex-1">{userDisplayName}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          title="Sign out"
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-colors group"
          style={{ color: '#64748b' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.10)'; (e.currentTarget as HTMLElement).style.color = '#fda4af'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Main Shell ───────────────────────────────────────────────────────────────

interface PoolTerminalShellProps {
  children: React.ReactNode;
}

export function PoolTerminalShell({ children }: PoolTerminalShellProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shellData, setShellData] = useState<PoolShellData | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(
    () => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('pool_facility_id') || null;
      }
      return null;
    }
  );
  const [incidentCount, setIncidentCount] = useState(0);
  const logout = useLogout();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [poolLoginOpen, setPoolLoginOpen] = useState(false);
  const { data: session } = useLodgeCoreSession();
  const userDisplayName = (session?.user as { name?: string } | undefined)?.name ?? 'Pool Staff';
  const userInitials = userDisplayName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    let active = true;
    const checkOperator = async () => {
      const sessionId = localStorage.getItem('lodgecore_pos_session_id') || '';
      const operatorToken = localStorage.getItem('lodgecore_pos_operator_token') || '';
      if (!sessionId || (!isDesktopMode && !operatorToken)) {
        if (active) setPoolLoginOpen(true);
        return;
      }
      try {
        const result = await provider.pos.getCurrentOperator(sessionId, operatorToken || undefined);
        if (active) setPoolLoginOpen(!(result?.data?.staff && result?.data?.operatorSession && !result.error));
      } catch {
        if (active) setPoolLoginOpen(true);
      }
    };
    void checkOperator();
    return () => { active = false; };
  }, [isDesktopMode, provider.pos]);

  const fetchShell = useCallback(async (fid?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (fid) params.set('facilityId', fid);
      const json = isDesktopMode
        ? await provider.pool.getSnapshot('', fid)
        : await (async () => {
            const res = await fetch(`/api/v1/pos/swimming-pool?${params.toString()}`);
            if (!res.ok) throw new Error('Pool shell unavailable');
            return res.json();
          })();
      const d = json.data;
      setShellData({
        businessDate: d.businessDate,
        currency: d.currency,
        facility: d.facility ? { id: d.facility.id, name: d.facility.name, status: d.facility.status, capacity: d.facility.capacity } : null,
        facilities: (d.facilities || []).map((f: { id: string; name: string; status: string; capacity: number }) => ({ id: f.id, name: f.name, status: f.status, capacity: f.capacity })),
        metrics: { occupancy: d.metrics?.occupancy ?? 0, capacity: d.metrics?.capacity ?? 0, incidents: d.incidents?.length ?? 0 },
      });
      setIncidentCount(d.incidents?.length ?? 0);
      // Cache selected facility
      if (d.facility?.id) {
        setFacilityId(d.facility.id);
        localStorage.setItem('pool_facility_id', d.facility.id);
      }
    } catch {
      // silent
    }
  }, [isDesktopMode, provider.pool]);

  useEffect(() => {
    fetchShell(facilityId);
    // Refresh every 2 minutes
    const timer = setInterval(() => fetchShell(facilityId), 120_000);
    return () => clearInterval(timer);
  }, [facilityId, fetchShell]);

  const handleFacilityChange = (id: string) => {
    setFacilityId(id);
    localStorage.setItem('pool_facility_id', id);
    fetchShell(id);
  };

  // Build page title from pathname
  const pageTitle = (() => {
    if (pathname === '/pos/swimming-pool') return 'Overview';
    const seg = pathname.split('/').pop() || '';
    return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  return (
    <div className="pool-dark-surface flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
      <TerminalAuthScreen
        authMode="POS_OPERATOR"
        isOpen={poolLoginOpen}
        cancellable={false}
        onAuthenticated={() => setPoolLoginOpen(false)}
      />
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          shellData={shellData}
          collapsed={collapsed}
          incidentCount={incidentCount}
          onFacilityChange={handleFacilityChange}
          onLogout={logout}
          userDisplayName={userDisplayName}
          userInitials={userInitials}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10" style={{ width: 220 }}>
            <Sidebar
              shellData={shellData}
              collapsed={false}
              incidentCount={incidentCount}
              onFacilityChange={handleFacilityChange}
              onLogout={logout}
              userDisplayName={userDisplayName}
              userInitials={userInitials}
            />
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Terminal header */}
        <header
          className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
          style={{ background: 'rgba(6,11,19,0.95)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
        >
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Sidebar collapse (desktop) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors"
          >
            <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>

          {/* Page title */}
          <div className="flex items-center gap-2 min-w-0">
            <Waves className="w-4 h-4 shrink-0" style={{ color: '#38bdf8' }} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color: '#475569' }}>
                Pool Terminal
              </p>
              <h1 className="text-sm font-bold leading-tight text-white truncate">{pageTitle}</h1>
            </div>
          </div>

          {/* Facility + status */}
          {shellData?.facility && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#64748b' }}>
              <span>·</span>
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: facilityStatusColour(shellData.facility.status) }}
              />
              <span>{shellData.facility.name}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Occupancy quick read */}
          {shellData && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(56,189,248,0.10)', color: '#7dd3fc' }}>
              <Users className="w-3.5 h-3.5" />
              <span>{shellData.metrics.occupancy}/{shellData.metrics.capacity}</span>
            </div>
          )}

          {/* Incident alert */}
          {incidentCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{incidentCount} open</span>
            </div>
          )}

          {/* Business date */}
          {shellData?.businessDate && (
            <div className="hidden md:block text-[11px] font-medium" style={{ color: '#475569' }}>
              {new Date(shellData.businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}

          {/* Sync status */}
          <SyncStatusChip />

          {/* Quick refresh */}
          <button
            onClick={() => fetchShell(facilityId)}
            title="Refresh shell data"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AmountInput } from '@/components/ui/amount-input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { FrontDeskCheckInDialog } from '@/components/frontdesk/FrontDeskCheckInDialog';
import { FrontDeskQuickCheckoutDialog } from '@/components/frontdesk/FrontDeskQuickCheckoutDialog';
import { FrontDeskReadCardDialog } from '@/components/frontdesk/FrontDeskReadCardDialog';
import { FrontDeskReencodeCardDialog } from '@/components/frontdesk/FrontDeskReencodeCardDialog';
import { ClientOnlyDate } from '@/components/ClientOnlyDate';
import { formatCurrency } from '@/lib/utils';
import { formatRoomNumber } from '@/lib/format-room';
import {
  UserPlus,
  CalendarPlus,
  CalendarDays,
  Search,
  LogIn,
  LogOut,
  Users,
  Key,
  Hotel,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Ban,
  Clock,
  Briefcase,
  ArrowRight,
  Info,
  KeySquare,
  Shirt,
  ChevronRight,
  Wifi,
  TrendingUp,
  DoorOpen,
  BedDouble,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Colour palette token helpers ──────────────────────────────────────────
const STATUS_CLASSES: Record<string, string> = {
  AVAILABLE:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  CLEAN:       'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  DIRTY:       'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  OUT_OF_ORDER:'bg-red-500/15 text-red-400 border border-red-500/20',
  MAINTENANCE: 'bg-red-500/15 text-red-400 border border-red-500/20',
  OCCUPIED:    'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
  RESERVED:    'bg-violet-500/15 text-violet-400 border border-violet-500/20',
  BLOCKED:     'bg-slate-500/15 text-slate-400 border border-slate-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE:    'Ready',
  CLEAN:        'Ready',
  DIRTY:        'Housekeeping',
  OUT_OF_ORDER: 'Out of Order',
  MAINTENANCE:  'Maintenance',
  OCCUPIED:     'Occupied',
  RESERVED:     'Reserved',
  BLOCKED:      'Blocked',
};

// Animated counter hook
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.floor(p * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent, glowColor, sub }: {
  label: string; value: number; icon: React.ElementType; accent: string; glowColor: string; sub?: string;
}) {
  const displayed = useCountUp(value);
  return (
    <div className={cn('relative overflow-hidden rounded-2xl p-6 border flex flex-col gap-5 group cursor-default transition-all duration-300 hover:-translate-y-0.5', accent)}>
      {/* Corner glow */}
      <div className={cn('absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none', glowColor)} />
      {/* Top row */}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-50">{label}</span>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border', accent.includes('indigo') ? 'bg-indigo-500/10 border-indigo-500/20' : accent.includes('amber') ? 'bg-amber-500/10 border-amber-500/20' : accent.includes('emerald') ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20')}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {/* Value */}
      <div className="relative z-10">
        <span className="text-5xl font-black tracking-tight leading-none">{displayed}</span>
        {sub && <p className="mt-2 text-[11px] opacity-50 font-semibold">{sub}</p>}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, sub, onClick, color }: {
  icon: React.ElementType; label: string; sub?: string; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-2 p-5 rounded-2xl border text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        color,
      )}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4" />
      </div>
      <div className="w-10 h-10 rounded-xl bg-current/10 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-bold text-sm leading-tight">{label}</p>
        {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex h-[112px] w-[112px] items-center justify-center shrink-0">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 92 92" aria-hidden="true">
        <circle cx="46" cy="46" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="url(#occupancy-gradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <defs>
          <linearGradient id="occupancy-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative text-center">
        <p className="text-2xl font-black tracking-tight text-white">{Math.round(safeValue)}%</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function PulseItem({ icon: Icon, label, value, tone = 'indigo', onClick }: {
  icon: React.ElementType; label: string; value: string; tone?: 'indigo' | 'amber' | 'emerald' | 'rose'; onClick?: () => void;
}) {
  const tones = {
    indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/15',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/15',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/15',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/15',
  };
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.045]">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-400">{label}</span>
        <span className="mt-0.5 block text-sm font-bold text-white">{value}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-slate-700 transition-all group-hover:translate-x-0.5 group-hover:text-slate-400" />
    </button>
  );
}

function GuestRow({ name, room, balance, availableCredit, roomStatus, status, checkOutTime, mode, onAction, onViewFolio }: {
  name: string; room: string; balance: number | null; availableCredit?: number;
  roomStatus?: string; status: string; checkOutTime?: string;
  mode: 'arrival' | 'departure';
  onAction: () => void; onViewFolio: () => void;
}) {
  const initials = name.split(' ').map((n: string) => n[0] ?? '').join('').substring(0, 2).toUpperCase();
  const isPaid = balance !== null && balance <= 0;
  const isArrival = mode === 'arrival';
  const isRoomReady = roomStatus === 'AVAILABLE' || roomStatus === 'CLEAN';
  const canAct = isArrival
    ? isPaid && isRoomReady && status === 'CONFIRMED'
    : isPaid && status === 'CHECKED_IN';

  const hue = name.charCodeAt(0) % 6;
  const avatarColors = [
    'bg-indigo-500/20 text-indigo-300', 'bg-emerald-500/20 text-emerald-300',
    'bg-violet-500/20 text-violet-300', 'bg-amber-500/20 text-amber-300',
    'bg-cyan-500/20 text-cyan-300', 'bg-rose-500/20 text-rose-300',
  ];

  return (
    <div className="group flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all duration-200">
      {/* Avatar */}
      <div className={cn('w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm', avatarColors[hue])}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-white text-sm truncate">{name}</h3>
          <span className="font-mono text-[10px] text-slate-500 shrink-0 bg-white/5 px-1.5 py-0.5 rounded">{formatRoomNumber(room)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Balance */}
          {balance === null ? (
            <span className="text-[11px] text-slate-500 flex items-center gap-1"><Info className="w-3 h-3" />Unknown</span>
          ) : isPaid ? (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold"><CheckCircle2 className="w-3 h-3" />Settled</span>
          ) : (
            <span className="text-[11px] text-rose-400 flex items-center gap-1 font-semibold"><CreditCard className="w-3 h-3" />{formatCurrency(balance)} Due</span>
          )}

          {Number(availableCredit ?? 0) > 0 && (
            <span className="text-[11px] text-indigo-400 font-semibold">{formatCurrency(Number(availableCredit))} Credit</span>
          )}

          {/* Room status (arrivals) */}
          {isArrival && roomStatus && (
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_CLASSES[roomStatus] || 'bg-white/10 text-slate-400')}>
              {STATUS_LABEL[roomStatus] ?? roomStatus}
            </span>
          )}

          {/* Checkout time (departures) */}
          {!isArrival && checkOutTime && status === 'CHECKED_IN' && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold"><Clock className="w-3 h-3" />By {checkOutTime}</span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {(isArrival ? status === 'CONFIRMED' : status === 'CHECKED_IN') ? (
          <button
            onClick={isPaid ? onAction : onViewFolio}
            className={cn(
              'h-9 px-4 rounded-xl text-xs font-bold transition-all duration-200 border',
              canAct
                ? isArrival
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-[0_0_16px_-4px_rgba(99,102,241,0.6)] hover:shadow-[0_0_20px_-4px_rgba(99,102,241,0.7)]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-300',
            )}
          >
            {isPaid ? (isArrival ? 'Check In' : 'Check Out') : 'View Folio'}
          </button>
        ) : status === 'CHECKED_OUT' ? (
          <span className="text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">Departed</span>
        ) : (
          <button
            onClick={onViewFolio}
            className="h-9 px-4 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all duration-200"
          >
            Manage
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const { provider, syncStatus } = useLodgeCoreProvider();

  const [checkInReservationId, setCheckInReservationId] = useState<string | null>(null);
  const [checkOutReservation, setCheckOutReservation] = useState<any | null>(null);
  const [quickCheckoutOpen, setQuickCheckoutOpen] = useState(false);
  const [reencodeCardOpen, setReencodeCardOpen] = useState(false);
  const [readCardOpen, setReadCardOpen] = useState(false);
  const [showStartShift, setShowStartShift] = useState(false);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [cashAccountId, setCashAccountId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [startingShift, setStartingShift] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures'>('arrivals');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['frontdesk', 'dashboard', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      return provider.dashboard.get(propertyId);
    },
    enabled: !!propertyId,
    refetchInterval: 10000,
  });

  const { data: cashierSession } = useQuery({
    queryKey: ['frontdesk', 'cashier-session', propertyId],
    queryFn: () => provider.frontdesk.getSession(propertyId!),
    enabled: !!propertyId,
    refetchInterval: 10000,
  });

  const userRole = String((session?.user as any)?.role || '').toUpperCase();
  const currentCashierSession = cashierSession?.data?.sessions?.[0] || cashierSession?.data?.session || null;

  useEffect(() => {
    if (userRole === 'RECEPTIONIST' && cashierSession && !currentCashierSession) setShowStartShift(true);
  }, [userRole, cashierSession, currentCashierSession]);

  useEffect(() => {
    if (!showStartShift || !propertyId) return;
    void provider.frontdesk.listCashAccounts(propertyId).then(result => {
      const accounts = result?.data || result || [];
      setCashAccounts(accounts);
      setCashAccountId(v => v || accounts[0]?.id || '');
    }).catch(e => setShiftError(e instanceof Error ? e.message : 'Unable to load tills'));
  }, [showStartShift, propertyId, provider.frontdesk]);

  const startShift = async () => {
    if (!propertyId || !cashAccountId) return;
    setStartingShift(true); setShiftError('');
    try {
      const result = await provider.frontdesk.openSession({ propertyId, cashAccountId, openingFloat: Number(openingFloat) || 0 });
      if (result?.error) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
      setShowStartShift(false);
      router.push('/frontdesk/cashier');
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : 'Unable to start cashier shift');
    } finally {
      setStartingShift(false);
    }
  };

  if (!propertyId) {
    return (
      <div className="min-h-screen bg-[#080c18] flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Hotel className="w-10 h-10 text-indigo-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">No Property Selected</h2>
          <p className="text-slate-400">Select a property from the header to begin your shift.</p>
        </div>
      </div>
    );
  }

  const dashboardData = res?.data || res;

  if (isLoading || !dashboardData?.kpis) {
    return (
      <div className="min-h-screen bg-[#080c18] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading operational dashboard…</p>
        </div>
      </div>
    );
  }

  const { kpis, hardware, arrivals, departures, businessDate } = dashboardData;
  const bDate = new Date(businessDate);
  const firstName = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Staff';
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  const filteredArrivals = arrivals.filter((a: any) =>
    a.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatRoomNumber(a.roomName).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDepartures = departures.filter((d: any) =>
    d.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatRoomNumber(d.roomName).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeList = activeTab === 'arrivals' ? filteredArrivals : filteredDepartures;
  const occupancyRate = kpis.roomsTotal > 0 ? (kpis.inHouse / kpis.roomsTotal) * 100 : 0;
  const readyRate = kpis.roomsTotal > 0 ? (kpis.roomsAvailable / kpis.roomsTotal) * 100 : 0;
  const unsettledArrivals = arrivals.filter((item: any) => item.balance !== null && Number(item.balance) > 0).length;
  const roomsNeedingAttention = Math.max(0, Number(kpis.roomsTotal || 0) - Number(kpis.roomsAvailable || 0) - Number(kpis.inHouse || 0));

  return (
    <div className="min-h-screen bg-[#080c18] text-slate-200">
      {/* ── Background decorative glows ───────────────────────────────── */}
      <div className="fixed pointer-events-none inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[100px]" />
      </div>

      {/* ── Start shift dialog ────────────────────────────────────────── */}
      <Dialog open={showStartShift} onOpenChange={setShowStartShift}>
        <DialogContent className="sm:max-w-md bg-[#0d1424] border border-white/10 text-slate-200 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold">Start Your Cashier Shift</DialogTitle>
            <DialogDescription className="text-slate-400">
              No active session found. Select your till and enter the opening float to begin.
            </DialogDescription>
          </DialogHeader>
          {shiftError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{shiftError}</div>}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Cashier Till</label>
              <select value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-slate-200 outline-none focus:border-indigo-500">
                <option value="" className="bg-slate-900">Select a till</option>
                {cashAccounts.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name} · {a.type}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Opening Float</label>
              <AmountInput min="0" value={openingFloat} onValueChange={setOpeningFloat} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setShowStartShift(false)} className="text-slate-400 hover:text-white">Later</Button>
            <Button onClick={startShift} disabled={startingShift || !cashAccountId} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl">
              {startingShift ? 'Starting…' : 'Start Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative z-10 max-w-[1440px] mx-auto px-5 md:px-8 lg:px-10 py-8 space-y-8">

        {/* ── Sync Error Banner ─────────────────────────────────────────── */}
        {syncStatus === 'error' && (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold text-sm text-red-300">Sync Error Detected</p>
              <p className="text-sm opacity-80">The desktop agent is failing to push data. Use the Push Queue button to view details.</p>
            </div>
          </div>
        )}

        {/* ── Command hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#172348] via-[#10182d] to-[#0c1221] p-6 md:p-8 shadow-[0_24px_80px_-36px_rgba(99,102,241,0.55)]">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/15 blur-[70px]" />
          <div className="pointer-events-none absolute bottom-[-140px] left-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-[80px]" />
          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-5">
              <ProgressRing value={occupancyRate} label="occupied" />
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">Live operations</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">{greeting}, {firstName}</h1>
                <p className="mt-2 text-sm font-medium text-slate-400"><ClientOnlyDate date={bDate} format="date" locale="en-GB" options={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }} /></p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:w-[700px]">
              <ActionBtn icon={UserPlus} label="Walk-In" sub="Instant stay" onClick={() => router.push('/frontdesk/reservations/walk-in')} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/40" />
              <ActionBtn icon={CalendarPlus} label="New booking" sub="Reservation" onClick={() => router.push('/frontdesk/reservations/new')} color="bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/15 hover:border-indigo-500/40" />
              <ActionBtn icon={Search} label="Find guest" sub="Search desk" onClick={() => router.push('/frontdesk/reservations')} color="bg-white/5 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20" />
              <ActionBtn icon={CreditCard} label="Read key" sub="Card tools" onClick={() => setReadCardOpen(true)} color="bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/40" />
              <ActionBtn icon={CalendarDays} label="Hall & Events" sub="Read-only schedule" onClick={() => router.push('/frontdesk/events')} color="bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-500/40" />
            </div>
          </div>
        </section>

        {/* ── KPI Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Arrivals Today"  value={kpis.arrivals}       icon={LogIn}     accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-300"  glowColor="bg-indigo-500" />
          <StatCard label="Departures"      value={kpis.departures}     icon={LogOut}    accent="bg-amber-500/10 border-amber-500/20 text-amber-300"    glowColor="bg-amber-500" />
          <StatCard label="In-House Guests" value={kpis.inHouse}        icon={Users}     accent="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" glowColor="bg-emerald-500" />
          <StatCard label="Rooms Available" value={kpis.roomsAvailable} icon={BedDouble} accent="bg-slate-500/10 border-slate-500/20 text-slate-300"      glowColor="bg-slate-400" sub={`of ${kpis.roomsTotal} sellable`} />
        </div>

        {/* ── Main workspace ────────────────────────────────────────────── */}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] backdrop-blur-xl overflow-hidden">
          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/8">
              <button
                onClick={() => setActiveTab('arrivals')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                  activeTab === 'arrivals'
                    ? 'bg-indigo-600 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.6)]'
                    : 'text-slate-400 hover:text-slate-300',
                )}
              >
                <DoorOpen className="w-4 h-4" />
                Arrivals
                <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full', activeTab === 'arrivals' ? 'bg-white/20' : 'bg-white/10 text-slate-500')}>
                  {arrivals.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('departures')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                  activeTab === 'departures'
                    ? 'bg-amber-600 text-white shadow-[0_0_20px_-5px_rgba(217,119,6,0.5)]'
                    : 'text-slate-400 hover:text-slate-300',
                )}
              >
                <LogOut className="w-4 h-4" />
                Departures
                <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full', activeTab === 'departures' ? 'bg-white/20' : 'bg-white/10 text-slate-500')}>
                  {departures.length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search guest or room…"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="p-5 space-y-2.5 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {activeList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-600">
                <Briefcase className="w-12 h-12 opacity-30" />
                <p className="text-sm font-semibold">
                  {searchQuery ? 'No results for your search.' : `No ${activeTab} today.`}
                </p>
              </div>
            ) : (
              activeList.map((item: any) => (
                <GuestRow
                  key={item.id}
                  name={item.guestName}
                  room={item.roomName}
                  balance={item.balance}
                  availableCredit={item.availableCredit}
                  roomStatus={item.roomStatus}
                  status={item.status}
                  checkOutTime={item.checkOutTime}
                  mode={activeTab === 'arrivals' ? 'arrival' : 'departure'}
                  onAction={() => {
                    if (activeTab === 'arrivals') {
                      setCheckInReservationId(item.id);
                    } else {
                      setCheckOutReservation({ id: item.id, folios: [{ balance: item.balance }] });
                    }
                  }}
                  onViewFolio={() => router.push(`/frontdesk/reservations/detail?id=${item.id}`)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Property pulse</p>
                <h2 className="mt-1 text-lg font-bold text-white">Today at a glance</h2>
              </div>
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <PulseItem icon={LogIn} label="Guests arriving" value={`${arrivals.length} scheduled today`} onClick={() => setActiveTab('arrivals')} />
              <PulseItem icon={LogOut} label="Guests departing" value={`${departures.length} due out`} tone="amber" onClick={() => setActiveTab('departures')} />
              <PulseItem icon={CheckCircle2} label="Rooms ready" value={`${kpis.roomsAvailable} of ${kpis.roomsTotal} sellable`} tone="emerald" onClick={() => router.push('/frontdesk/rooms')} />
              <PulseItem icon={AlertCircle} label="Needs attention" value={`${roomsNeedingAttention + unsettledArrivals} open items`} tone={roomsNeedingAttention + unsettledArrivals > 0 ? 'rose' : 'emerald'} onClick={() => router.push('/frontdesk/housekeeping')} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Room readiness</p>
                <p className="mt-1 text-2xl font-black text-white">{Math.round(readyRate)}%</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <BedDouble className="h-5 w-5" />
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all" style={{ width: `${Math.min(100, readyRate)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>{kpis.roomsAvailable} ready to sell</span>
              <span>{Math.max(0, Number(kpis.roomsTotal || 0) - Number(kpis.roomsAvailable || 0))} in use / service</span>
            </div>
          </div>

          <button onClick={() => router.push('/frontdesk/cashier')} className="group flex w-full items-center gap-3 rounded-3xl border border-indigo-400/15 bg-indigo-500/10 p-5 text-left transition-all hover:border-indigo-400/30 hover:bg-indigo-500/15">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-400/15 text-indigo-200"><TrendingUp className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block text-sm font-bold text-white">Keep the desk moving</span><span className="mt-1 block text-xs text-indigo-200/60">Review your cashier shift</span></span>
            <ArrowRight className="h-4 w-4 text-indigo-300 transition-transform group-hover:translate-x-1" />
          </button>
        </aside>
        </div>

        {/* ── Bottom quick links strip ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Cashier Shift',  icon: TrendingUp, action: () => router.push('/frontdesk/cashier'),      color: 'text-emerald-400' },
            { label: 'Room Status',    icon: Key,         action: () => router.push('/frontdesk/rooms'),        color: 'text-indigo-400' },
            { label: 'Housekeeping',   icon: Briefcase,   action: () => router.push('/frontdesk/housekeeping'), color: 'text-amber-400' },
            { label: 'Laundry',        icon: Shirt,       action: () => router.push('/laundry'),                 color: 'text-cyan-400' },
            { label: 'Re-Encode Card', icon: KeySquare,   action: () => setReencodeCardOpen(true),             color: 'text-rose-400' },
            { label: 'Quick Checkout', icon: KeySquare,   action: () => setQuickCheckoutOpen(true),            color: 'text-violet-400' },
          ].map(({ label, icon: Icon, action, color }) => (
            <button
              key={label}
              onClick={action}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.06] hover:border-white/15 transition-all group"
            >
              <Icon className={cn('w-5 h-5 shrink-0', color)} />
              <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors ml-auto" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {checkInReservationId && (
        <FrontDeskCheckInDialog
          open={!!checkInReservationId}
          onOpenChange={open => !open && setCheckInReservationId(null)}
          reservationId={checkInReservationId}
          propertyId={propertyId}
        />
      )}
      {checkOutReservation && (
        <FrontDeskQuickCheckoutDialog
          open={!!checkOutReservation}
          onOpenChange={open => !open && setCheckOutReservation(null)}
          propertyId={propertyId}
          initialReservation={checkOutReservation}
        />
      )}
      <FrontDeskQuickCheckoutDialog open={quickCheckoutOpen} onOpenChange={setQuickCheckoutOpen} propertyId={propertyId} />
      <FrontDeskReencodeCardDialog open={reencodeCardOpen} onOpenChange={setReencodeCardOpen} propertyId={propertyId} />
      <FrontDeskReadCardDialog open={readCardOpen} onOpenChange={setReadCardOpen} propertyId={propertyId} />
    </div>
  );
}

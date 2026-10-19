'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Waves, Plus, ScanLine, ShieldCheck, AlertTriangle,
  Users, TrendingUp, Ticket, RefreshCw, ChevronRight,
  UserCheck, Clock, Activity, Loader2, X, Check,
  BadgeAlert, Ban, Banknote, CreditCard, User,
  Building2, ReceiptText, TriangleAlert, Info,
  Zap, ArrowUpRight, ArrowDownRight, Droplets, Wind,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  formatMoney, formatTime, formatDateTime, occupancyPct, occupancyColour,
  evaluateSafetyGate, ENTRY_STATUS_STYLES, INCIDENT_SEVERITY_STYLES,
  SAFETY_STATUS_STYLES, newOperationId, POOL_API,
} from './_components/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PassType {
  id: string;
  name: string;
  code: string;
  guestClass: string;
  price: number;
  currency: string;
  isComplimentary: boolean;
  isActive?: boolean;
  productId: string | null;
  maxDuration: number;
}

interface PoolEntry {
  id: string;
  entryNumber: string;
  identifier: string | null;
  status: string;
  guestCount: number;
  admittedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  waiverAccepted: boolean;
  notes: string | null;
  guest: { id: string; firstName: string; lastName: string; phone: string } | null;
  passType: { name: string; code: string; guestClass: string };
}

interface Incident {
  id: string;
  severity: string;
  status: string;
  title: string;
  createdAt: string;
}

interface SafetyCheck {
  id: string;
  checkType: string;
  status: string;
  chlorine: number | null;
  ph: number | null;
  checkedAt: string;
}

interface GuestMatch {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  reservations: {
    id: string;
    confirmationNumber: string;
    status: string;
    folios: { id: string; folioNumber: string; balance: number }[];
  }[];
}

interface DashData {
  businessDate: string;
  currency: string;
  bankingModel: string;
  poolOutletId: string | null;
  facility: { id: string; name: string; status: string; capacity: number } | null;
  facilities: { id: string; name: string; status: string }[];
  passTypes: PassType[];
  metrics: { occupancy: number; capacity: number; available: number; admissions: number; revenue: number };
  activeEntries: PoolEntry[];
  todayEntries: PoolEntry[];
  incidents: Incident[];
  latestSafety: SafetyCheck | null;
  guestMatches: GuestMatch[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Build hourly admission heatmap from today's entries */
function buildHourlyData(entries: PoolEntry[]) {
  const hours: { hour: string; count: number; active: number }[] = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    count: 0,
    active: 0,
  }));
  for (const e of entries) {
    const ts = e.admittedAt ?? e.createdAt;
    const h = new Date(ts).getHours();
    hours[h].count += 1;
    if (e.status === 'ACTIVE') hours[h].active += 1;
  }
  // Only return hours with activity ±2 of current hour (last 12 hrs)
  const now = new Date().getHours();
  const start = Math.max(0, now - 11);
  return hours.slice(start, now + 1);
}

/** Build pass-type distribution */
function buildPassDist(entries: PoolEntry[]) {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const key = e.passType.name;
    map[key] = (map[key] ?? 0) + e.guestCount;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

const PIE_COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#f59e0b', '#fb923c', '#fda4af'];

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px]" style={{ background: '#0a1726', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {label && <p className="font-bold text-white mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? '#38bdf8' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Safety Gate Banner ────────────────────────────────────────────────────────

function SafetyGateBanner({ gate }: { gate: ReturnType<typeof evaluateSafetyGate> }) {
  if (!gate.warning) return null;
  return (
    <div className={`pool-gate-banner ${gate.blocked ? 'danger' : 'warning'} mb-4`}>
      {gate.blocked ? <Ban className="w-4 h-4 shrink-0" /> : <TriangleAlert className="w-4 h-4 shrink-0" />}
      <span>{gate.warning}</span>
    </div>
  );
}

// ─── Animated Occupancy Ring ───────────────────────────────────────────────────

function OccupancyRing({ occupied, capacity }: { occupied: number; capacity: number }) {
  const pct = occupancyPct(occupied, capacity);
  const colour = occupancyColour(pct);
  const size = 110;
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const available = Math.max(0, capacity - occupied);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow */}
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${colour}18 0%, transparent 70%)` }} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={colour}
            strokeWidth={10}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1), stroke 0.4s ease', filter: `drop-shadow(0 0 6px ${colour}88)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none" style={{ color: colour }}>{pct}%</span>
          <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#475569' }}>full</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-center">
        <div>
          <p className="text-base font-black text-white">{occupied}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>In pool</p>
        </div>
        <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <p className="text-base font-black text-white">{available}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>Free</p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <div
      className="pool-metric flex flex-col gap-2 relative overflow-hidden"
      style={{ background: 'rgba(10,18,32,0.85)' }}
    >
      {/* Background glow spot */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20" style={{ background: accent, filter: 'blur(20px)' }} />
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}22` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        {trend && (
          <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: trend === 'up' ? 'rgba(52,211,153,0.12)' : 'rgba(244,63,94,0.12)', color: trend === 'up' ? '#34d399' : '#fda4af' }}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{label}</p>
        <p className="text-xl font-black text-white leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Entry Row ─────────────────────────────────────────────────────────────────

function EntryRow({ entry, onCheckout, checkingOut }: {
  entry: PoolEntry;
  onCheckout: (id: string) => void;
  checkingOut: string | null;
}) {
  const st = ENTRY_STATUS_STYLES[entry.status as keyof typeof ENTRY_STATUS_STYLES]
    ?? { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', label: entry.status };
  const guestName = entry.guest
    ? `${entry.guest.firstName} ${entry.guest.lastName}`.trim()
    : 'Walk-in Guest';
  const initials = entry.guest
    ? `${entry.guest.firstName[0]}${entry.guest.lastName[0]}`
    : 'WI';

  return (
    <div className="pool-entry-row flex items-center gap-3 px-4 py-2.5">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black" style={{ background: `${st.text}18`, color: st.text }}>
        {initials}
      </div>

      {/* Guest info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{guestName}</p>
        <p className="text-[11px]" style={{ color: '#64748b' }}>
          {entry.passType.name} · {entry.guestCount} guest{entry.guestCount !== 1 ? 's' : ''}
          {entry.identifier ? ` · 🏷 ${entry.identifier}` : ''}
        </p>
      </div>

      {/* Time in pool */}
      {entry.admittedAt && entry.status === 'ACTIVE' && (
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono shrink-0" style={{ color: '#475569' }}>
          <Clock className="w-2.5 h-2.5" />
          {formatTime(entry.admittedAt)}
        </div>
      )}

      {/* Status badge */}
      <span className="hidden md:inline text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.text }}>
        {st.label}
      </span>

      {/* Action */}
      {entry.status === 'ACTIVE' && (
        <button
          onClick={() => onCheckout(entry.id)}
          disabled={checkingOut === entry.id}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0 hover:scale-105"
          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.18)' }}
        >
          {checkingOut === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
          <span className="hidden sm:inline">Out</span>
        </button>
      )}
    </div>
  );
}

// ─── New Admission Dialog ──────────────────────────────────────────────────────

type AdmissionStep = 'guest' | 'pass' | 'payment' | 'confirm';

interface AdmissionState {
  step: AdmissionStep;
  guestSearch: string;
  selectedGuest: GuestMatch | null;
  selectedFolioId: string | null;
  passTypeId: string;
  guestCount: number;
  identifier: string;
  notes: string;
  method: string;
  admitNow: boolean;
  waiverAccepted: boolean;
  operationId: string;
  isLoading: boolean;
  error: string | null;
}

function NewAdmissionDialog({ data, onClose, onSuccess }: {
  data: DashData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<AdmissionState>({
    step: 'guest',
    guestSearch: '',
    selectedGuest: null,
    selectedFolioId: null,
    passTypeId: (data.passTypes ?? [])[0]?.id ?? '',
    guestCount: 1,
    identifier: '',
    notes: '',
    method: data.bankingModel === 'SERVER_BANKING' ? 'CASH' : 'CASH',
    admitNow: true,
    waiverAccepted: false,
    operationId: newOperationId('ADM'),
    isLoading: false,
    error: null,
  });

  const [guestMatches, setGuestMatches] = useState<GuestMatch[]>(data.guestMatches ?? []);
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  const set = (patch: Partial<AdmissionState>) => setState((s) => ({ ...s, ...patch }));

  const selectedPass = (data.passTypes ?? []).find((p) => p.id === state.passTypeId);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (state.guestSearch.length < 2) { setGuestMatches([]); return; }
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${POOL_API}?search=${encodeURIComponent(state.guestSearch)}`);
        const json = await res.json();
        setGuestMatches(json.data?.guestMatches ?? []);
      } catch { /* silent */ }
    }, 300);
  }, [state.guestSearch]);

  const handleConfirm = async () => {
    set({ isLoading: true, error: null });
    try {
      const isRoomCharge = state.method === 'ROOM_CHARGE';
      const isComplimentary = state.method === 'COMPLIMENTARY';

      let posOrderId: string | null = null;
      if (!isComplimentary && selectedPass?.productId && selectedPass.price > 0) {
        const saleRes = await fetch(POOL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sale',
            passTypeId: state.passTypeId,
            guestCount: state.guestCount,
            method: state.method,
            folioId: isRoomCharge ? state.selectedFolioId : undefined,
            reservationId: state.selectedGuest?.reservations?.[0]?.id,
            operationId: `${state.operationId}-SALE`,
            displayName: `Pool admission — ${selectedPass.name} × ${state.guestCount}`,
          }),
        });
        if (!saleRes.ok) {
          const j = await saleRes.json();
          throw new Error(j.error || 'Payment failed');
        }
        const saleData = await saleRes.json();
        posOrderId = saleData.data?.orderId ?? null;
      }

      const entryRes = await fetch(POOL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'entry',
          facilityId: data.facility?.id,
          passTypeId: state.passTypeId,
          guestId: state.selectedGuest?.id ?? undefined,
          reservationId: state.selectedGuest?.reservations?.[0]?.id ?? undefined,
          folioId: isRoomCharge ? state.selectedFolioId : undefined,
          posOrderId: posOrderId ?? undefined,
          guestCount: state.guestCount,
          identifier: state.identifier || undefined,
          notes: state.notes || undefined,
          waiverAccepted: true,
          admitNow: state.admitNow,
          operationId: state.operationId,
        }),
      });
      if (!entryRes.ok) {
        const j = await entryRes.json();
        throw new Error(j.error || 'Admission failed');
      }

      onSuccess();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Admission failed', isLoading: false });
    }
  };

  const steps: { key: AdmissionStep; label: string }[] = [
    { key: 'guest', label: 'Guest' },
    { key: 'pass', label: 'Pass & Party' },
    { key: 'payment', label: 'Payment' },
    { key: 'confirm', label: 'Confirm' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 32px 100px rgba(0,0,0,0.65)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'linear-gradient(135deg, rgba(56,189,248,0.06), transparent)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.16)' }}>
              <Ticket className="w-4 h-4" style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Pool Terminal</p>
              <h2 className="text-sm font-black text-white">New Admission</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <button onClick={() => { if (i < steps.findIndex((x) => x.key === state.step)) set({ step: s.key }); }} className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: state.step === s.key ? '#38bdf8' : steps.findIndex((x) => x.key === state.step) > i ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)', color: state.step === s.key ? '#070d16' : steps.findIndex((x) => x.key === state.step) > i ? '#34d399' : '#475569' }}>
                  {steps.findIndex((x) => x.key === state.step) > i ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="text-[11px] font-medium hidden sm:block" style={{ color: state.step === s.key ? '#38bdf8' : '#475569' }}>{s.label}</span>
              </button>
              {i < steps.length - 1 && <div className="flex-1 mx-2 h-px" style={{ background: 'rgba(255,255,255,0.08)', minWidth: 8 }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          {state.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.28)', color: '#fda4af' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}

          {/* Step: Guest */}
          {state.step === 'guest' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Search checked-in guest (optional)</label>
                <input type="text" placeholder="Name or phone…" value={state.guestSearch} onChange={(e) => set({ guestSearch: e.target.value, selectedGuest: null })} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} autoFocus />
              </div>
              {guestMatches.length > 0 && (
                <div className="space-y-1.5">
                  {guestMatches.map((g) => (
                    <button key={g.id} onClick={() => { set({ selectedGuest: g, guestSearch: `${g.firstName} ${g.lastName}` }); if (g.reservations[0]?.folios[0]) set({ selectedFolioId: g.reservations[0].folios[0].id }); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors" style={{ background: state.selectedGuest?.id === g.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.selectedGuest?.id === g.id ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}` }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>{g.firstName[0]}{g.lastName[0]}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{g.firstName} {g.lastName}</p>
                        <p className="text-[11px]" style={{ color: '#64748b' }}>{g.phone}{g.reservations[0] && ` · ${g.reservations[0].confirmationNumber} (${g.reservations[0].status})`}</p>
                      </div>
                      {state.selectedGuest?.id === g.id && <Check className="w-4 h-4 ml-auto shrink-0" style={{ color: '#38bdf8' }} />}
                    </button>
                  ))}
                </div>
              )}
              {state.guestSearch.length > 0 && guestMatches.length === 0 && (
                <div className="text-center py-4 text-sm" style={{ color: '#475569' }}>
                  <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No checked-in guests found — you can continue as a walk-in guest.
                </div>
              )}
              {!state.selectedGuest && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-[12px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#475569' }} />
                  <span style={{ color: '#64748b' }}>No guest selected — this will be recorded as a walk-in admission.</span>
                </div>
              )}
            </div>
          )}

          {/* Step: Pass & Party */}
          {state.step === 'pass' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Pass Type</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {(data.passTypes ?? []).filter(p => p.isActive !== false).map((p) => (
                    <button key={p.id} onClick={() => set({ passTypeId: p.id })} className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors" style={{ background: state.passTypeId === p.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.passTypeId === p.id ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-[11px]" style={{ color: '#64748b' }}>{p.guestClass} · max {p.maxDuration / 60}h</p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.isComplimentary ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Complimentary</span>
                        ) : (
                          <span className="text-sm font-bold text-white">{formatMoney(Number(p.price), p.currency)}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Party size</label>
                  <input type="number" min={1} max={20} value={state.guestCount} onChange={(e) => set({ guestCount: Math.max(1, Math.min(20, Number(e.target.value))) })} className="w-full px-3 py-2.5 rounded-xl text-sm text-center font-bold" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Wristband / ID (optional)</label>
                  <input type="text" placeholder="A001" value={state.identifier} onChange={(e) => set({ identifier: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Notes (optional)</label>
                <textarea rows={2} placeholder="Any special requirements…" value={state.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm resize-none" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Admission mode</label>
                <div className="flex gap-2">
                  {[{ v: true, l: 'Admit now (ACTIVE)' }, { v: false, l: 'Reserve (check-in later)' }].map(({ v, l }) => (
                    <button key={String(v)} onClick={() => set({ admitNow: v })} className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-colors" style={{ background: state.admitNow === v ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.admitNow === v ? 'rgba(56,189,248,0.30)' : 'rgba(255,255,255,0.08)'}`, color: state.admitNow === v ? '#38bdf8' : '#64748b' }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {state.step === 'payment' && (
            <div className="space-y-4">
              {selectedPass && !selectedPass.isComplimentary && selectedPass.price > 0 ? (
                <>
                  <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Amount due</p>
                    <p className="text-3xl font-black" style={{ color: '#38bdf8' }}>{formatMoney(Number(selectedPass.price) * state.guestCount, selectedPass.currency)}</p>
                    <p className="text-[11px] mt-1" style={{ color: '#64748b' }}>{selectedPass.name} × {state.guestCount}</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Payment method</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { v: 'CASH', l: 'Cash', icon: Banknote },
                        { v: 'CARD', l: 'Card / POS', icon: CreditCard },
                        { v: 'ROOM_CHARGE', l: 'Room Charge', icon: Building2, disabled: !state.selectedGuest?.reservations?.length },
                        { v: 'COMPLIMENTARY', l: 'Complimentary', icon: ReceiptText },
                      ].map(({ v, l, icon: Icon, disabled }) => (
                        <button key={v} disabled={disabled} onClick={() => set({ method: v })} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-30" style={{ background: state.method === v ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.method === v ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}`, color: state.method === v ? '#38bdf8' : '#94a3b8' }}>
                          <Icon className="w-3.5 h-3.5" />{l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {state.method === 'ROOM_CHARGE' && state.selectedGuest && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>Select folio</label>
                      {state.selectedGuest.reservations.flatMap((r) => r.folios).map((f) => (
                        <button key={f.id} onClick={() => set({ selectedFolioId: f.id })} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm mb-1 transition-colors" style={{ background: state.selectedFolioId === f.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.selectedFolioId === f.id ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}` }}>
                          <span className="font-medium text-white">{f.folioNumber}</span>
                          <span style={{ color: '#64748b' }}>{formatMoney(f.balance)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <Check className="w-5 h-5" style={{ color: '#34d399' }} />
                  <div>
                    <p className="text-sm font-bold text-white">No payment required</p>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>{selectedPass?.isComplimentary ? 'This is a complimentary pass.' : 'This pass has no charge.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm */}
          {state.step === 'confirm' && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
                {[
                  { l: 'Guest', v: state.selectedGuest ? `${state.selectedGuest.firstName} ${state.selectedGuest.lastName}` : 'Walk-in' },
                  { l: 'Pass', v: selectedPass?.name ?? '—' },
                  { l: 'Party size', v: `${state.guestCount} guest${state.guestCount !== 1 ? 's' : ''}` },
                  { l: 'Mode', v: state.admitNow ? 'Admit now' : 'Reserve' },
                  ...(state.identifier ? [{ l: 'Wristband', v: state.identifier }] : []),
                  { l: 'Payment', v: state.method.replace(/_/g, ' ') },
                  ...(selectedPass && !selectedPass.isComplimentary && selectedPass.price > 0
                    ? [{ l: 'Amount', v: formatMoney(Number(selectedPass.price) * state.guestCount, selectedPass.currency) }]
                    : []),
                  { l: 'Facility', v: data.facility?.name ?? '—' },
                ].map(({ l, v }) => (
                  <div key={l} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[11px] font-medium" style={{ color: '#64748b' }}>{l}</span>
                    <span className="text-sm font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => set({ waiverAccepted: !state.waiverAccepted })} className="w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left" style={{ background: state.waiverAccepted ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.04)', border: `1px solid ${state.waiverAccepted ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0" style={{ background: state.waiverAccepted ? '#34d399' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {state.waiverAccepted && <Check className="w-2.5 h-2.5 text-black" />}
                </div>
                <p className="text-[12px]" style={{ color: '#94a3b8' }}>I confirm the guest(s) have acknowledged the pool safety rules, swim-at-own-risk notice, and liability waiver.</p>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.09)' }}>
          {state.step !== 'guest' && (
            <button onClick={() => { const idx = steps.findIndex((s) => s.key === state.step); if (idx > 0) set({ step: steps[idx - 1].key, error: null }); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Back</button>
          )}
          <div className="flex-1" />
          {state.step === 'confirm' ? (
            <button onClick={handleConfirm} disabled={!state.waiverAccepted || state.isLoading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#07111f', boxShadow: '0 4px 20px rgba(56,189,248,0.30)' }}>
              {state.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {state.admitNow ? 'Admit Guest' : 'Reserve Admission'}
            </button>
          ) : (
            <button onClick={() => { const idx = steps.findIndex((s) => s.key === state.step); if (idx < steps.length - 1) set({ step: steps[idx + 1].key, error: null }); }} disabled={state.step === 'pass' && !state.passTypeId} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40" style={{ background: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.28)' }}>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Page ─────────────────────────────────────────────────────────────

export default function PoolOverviewPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmission, setShowAdmission] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // live clock

  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      const res = await fetch(`${POOL_API}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load pool data');
      const json = await res.json();
      setData(json.data);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  // Live clock tick every second
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const handleCheckout = async (entryId: string) => {
    setCheckingOut(entryId);
    try {
      const res = await fetch(`${POOL_API}/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout' }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error || 'Check-out failed'); }
      else await load();
    } catch { alert('Check-out failed. Please try again.'); }
    finally { setCheckingOut(null); }
  };

  // Derived chart data
  const hourlyData = useMemo(() => buildHourlyData(data?.todayEntries ?? []), [data]);
  const passDist = useMemo(() => buildPassDist(data?.todayEntries ?? []), [data]);

  const now = new Date();
  const clockStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  void tick; // consumed by clock

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ minHeight: 400 }}>
        <div className="relative w-12 h-12">
          <Waves className="w-12 h-12 opacity-20 absolute" style={{ color: '#38bdf8' }} />
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#38bdf8' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: '#64748b' }}>Loading pool operations…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center" style={{ minHeight: 400 }}>
        <AlertTriangle className="w-10 h-10" style={{ color: '#f59e0b' }} />
        <p className="text-white font-bold">{error || 'No pool data available'}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8' }}>
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data.facility) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center" style={{ minHeight: 400 }}>
        <Waves className="w-12 h-12 opacity-20" style={{ color: '#38bdf8' }} />
        <p className="text-lg font-black text-white">No Pool Facility Configured</p>
        <p className="text-sm max-w-xs" style={{ color: '#475569' }}>Set up a pool facility in the Settings tab to start managing pool operations.</p>
        <Link href="/pos/swimming-pool/settings" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>Open Settings</Link>
      </div>
    );
  }

  const gate = evaluateSafetyGate({
    facilityStatus: data.facility.status as 'OPEN' | 'CLOSED' | 'MAINTENANCE' | 'WEATHER_HOLD',
    latestSafetyCheck: data.latestSafety ? { status: data.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED', checkType: data.latestSafety.checkType, checkedAt: data.latestSafety.checkedAt } : null,
    openIncidents: (data.incidents ?? []).map((i) => ({ severity: i.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })),
  });

  const activeEntries = data.activeEntries ?? [];
  const todayReserved = (data.todayEntries ?? []).filter((e) => e.status === 'RESERVED');
  const pct = occupancyPct(data.metrics.occupancy, data.metrics.capacity);
  const incidents = data.incidents ?? [];
  const hasCritical = incidents.some((i) => i.severity === 'CRITICAL');

  return (
    <div className="p-4 md:p-5 space-y-4 overflow-auto h-full" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>

      {/* Safety Gate */}
      <SafetyGateBanner gate={gate} />

      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="pool-live-dot" />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>
              {data.facility.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{
              background: data.facility.status === 'OPEN' ? 'rgba(52,211,153,0.15)' : 'rgba(244,63,94,0.15)',
              color: data.facility.status === 'OPEN' ? '#34d399' : '#fda4af',
            }}>
              {data.facility.status}
            </span>
          </div>
          <h1 className="text-lg font-black text-white">Pool Operations</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-black tabular-nums" style={{ color: '#38bdf8' }}>{clockStr}</p>
            <p className="text-[10px]" style={{ color: '#475569' }}>
              {new Date(data.businessDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={load} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#38bdf8'; (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Top Metrics Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Occupancy Ring — spans 1 col */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl flex flex-col items-center justify-center py-5" style={{ border: `1px solid ${pct >= 90 ? 'rgba(244,63,94,0.30)' : pct >= 70 ? 'rgba(245,158,11,0.25)' : 'rgba(52,211,153,0.20)'}`, background: 'rgba(10,18,32,0.85)' }}>
          <OccupancyRing occupied={data.metrics.occupancy} capacity={data.metrics.capacity} />
        </div>
        <KpiCard label="Today's Admissions" value={data.metrics.admissions} sub={`${activeEntries.length} active in pool`} icon={Ticket} accent="#38bdf8" trend="up" />
        <KpiCard label="Today's Revenue" value={formatMoney(data.metrics.revenue, data.currency)} sub="Pool POS outlet" icon={TrendingUp} accent="#34d399" trend="up" />
        <KpiCard label="Reserved / Pending" value={todayReserved.length} sub="Awaiting check-in" icon={Clock} accent="#a78bfa" />
        <KpiCard label="Open Incidents" value={incidents.length} sub={data.latestSafety ? `Last check: ${SAFETY_STATUS_STYLES[data.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED']?.label ?? '—'}` : 'No safety check today'} icon={hasCritical ? AlertTriangle : ShieldCheck} accent={hasCritical ? '#ef4444' : incidents.length > 0 ? '#f59e0b' : '#34d399'} />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── Left Column: Charts + Guest Register ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Hourly admissions sparkline */}
            <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Hourly Traffic</p>
                  <p className="text-sm font-bold text-white">Today's flow</p>
                </div>
                <Activity className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
              </div>
              {hourlyData.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[12px]" style={{ color: '#475569' }}>No admissions yet today</div>
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={hourlyData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="admGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} fill="url(#admGrad)" name="Admissions" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pass-type distribution donut */}
            <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Pass Mix</p>
                  <p className="text-sm font-bold text-white">By type today</p>
                </div>
                <Ticket className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              </div>
              {passDist.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[12px]" style={{ color: '#475569' }}>No admissions yet</div>
              ) : (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={passDist} dataKey="value" cx="50%" cy="50%" innerRadius={26} outerRadius={42} strokeWidth={0}>
                        {passDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => active && payload?.length ? (
                        <div className="rounded-lg px-2 py-1.5 text-[11px]" style={{ background: '#0a1726', border: '1px solid rgba(255,255,255,0.12)' }}>
                          <p className="font-bold text-white">{payload[0].name}</p>
                          <p style={{ color: '#38bdf8' }}>{payload[0].value} guests</p>
                        </div>
                      ) : null} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {passDist.slice(0, 4).map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[10px] text-white truncate flex-1">{d.name}</span>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Water quality bar */}
          {data.latestSafety && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap" style={{ border: `1px solid ${data.latestSafety.status === 'PASS' ? 'rgba(52,211,153,0.20)' : data.latestSafety.status === 'FAILED' ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.20)'}`, background: 'rgba(10,18,32,0.85)' }}>
              <div className="flex items-center gap-2 shrink-0">
                <Droplets className="w-4 h-4" style={{ color: data.latestSafety.status === 'PASS' ? '#34d399' : data.latestSafety.status === 'FAILED' ? '#fda4af' : '#fcd34d' }} />
                <span className="text-[11px] font-bold text-white">Water Quality</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: SAFETY_STATUS_STYLES[data.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED']?.bg, color: SAFETY_STATUS_STYLES[data.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED']?.text }}>
                  {SAFETY_STATUS_STYLES[data.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED']?.label}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap text-[11px]">
                {data.latestSafety.chlorine != null && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: '#475569' }}>Chlorine</span>
                    <span className="font-black text-white">{data.latestSafety.chlorine} ppm</span>
                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.latestSafety.chlorine / 5) * 100)}%`, background: data.latestSafety.chlorine >= 1 && data.latestSafety.chlorine <= 3 ? '#34d399' : '#fcd34d' }} />
                    </div>
                  </div>
                )}
                {data.latestSafety.ph != null && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: '#475569' }}>pH</span>
                    <span className="font-black text-white">{data.latestSafety.ph}</span>
                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((data.latestSafety.ph - 6) / 2) * 100)}%`, background: data.latestSafety.ph >= 7.2 && data.latestSafety.ph <= 7.6 ? '#34d399' : '#fcd34d' }} />
                    </div>
                  </div>
                )}
                <span className="ml-auto text-[10px]" style={{ color: '#475569' }}>Checked {formatTime(data.latestSafety.checkedAt)}</span>
              </div>
              <Link href="/pos/swimming-pool/safety" className="ml-auto shrink-0 text-[10px] font-bold flex items-center gap-1" style={{ color: '#38bdf8' }}>
                Log check <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Live Guest Register */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: '#38bdf8' }} />
                <span className="text-sm font-bold text-white">Live Guest Register</span>
                <div className="pool-live-dot" />
                {activeEntries.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8' }}>{activeEntries.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tabular-nums" style={{ color: '#475569' }}>
                  {lastRefresh.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
                <button onClick={load} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {activeEntries.length === 0 && todayReserved.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Users className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
                <p className="text-sm" style={{ color: '#475569' }}>No guests in pool right now</p>
              </div>
            ) : (
              <div>
                {activeEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onCheckout={handleCheckout} checkingOut={checkingOut} />
                ))}
                {todayReserved.length > 0 && (
                  <>
                    <div className="px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(167,139,250,0.04)' }}>
                      <Clock className="w-3 h-3" style={{ color: '#a78bfa' }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                        Awaiting Check-In ({todayReserved.length})
                      </span>
                    </div>
                    {todayReserved.slice(0, 5).map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onCheckout={handleCheckout} checkingOut={checkingOut} />
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="px-4 py-2.5 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-[10px]" style={{ color: '#475569' }}>{data.todayEntries.length} total entries today</span>
              <Link href="/pos/swimming-pool/admissions" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#38bdf8' }}>
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right Column: Actions + Status ── */}
        <div className="space-y-3">

          {/* Quick Actions */}
          <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => !gate.blocked && setShowAdmission(true)}
                disabled={gate.blocked}
                className="flex flex-col items-center gap-2 py-4 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: gate.blocked ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(56,189,248,0.20), rgba(56,189,248,0.10))', color: gate.blocked ? '#475569' : '#38bdf8', border: `1px solid ${gate.blocked ? 'rgba(255,255,255,0.07)' : 'rgba(56,189,248,0.30)'}`, boxShadow: gate.blocked ? 'none' : '0 4px 20px rgba(56,189,248,0.12)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: gate.blocked ? 'rgba(255,255,255,0.06)' : 'rgba(56,189,248,0.18)' }}>
                  <Plus className="w-4 h-4" />
                </div>
                New Admission
              </button>
              <Link href="/pos/swimming-pool/check-in" className="flex flex-col items-center gap-2 py-4 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.08))', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 4px 20px rgba(52,211,153,0.10)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.18)' }}>
                  <ScanLine className="w-4 h-4" />
                </div>
                Check In
              </Link>
              <Link href="/pos/swimming-pool/safety" className="flex flex-col items-center gap-2 py-4 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.22)', boxShadow: '0 4px 20px rgba(245,158,11,0.08)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.18)' }}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                Safety Check
              </Link>
              <Link href="/pos/swimming-pool/safety" className="flex flex-col items-center gap-2 py-4 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.08))', color: '#fda4af', border: '1px solid rgba(244,63,94,0.22)', boxShadow: '0 4px 20px rgba(244,63,94,0.08)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.18)' }}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                Incident
              </Link>
            </div>
          </div>

          {/* Capacity mini-chart */}
          <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Capacity breakdown</p>
            <div className="space-y-2">
              {[
                { label: 'Active in pool', value: data.metrics.occupancy, max: data.metrics.capacity, color: '#38bdf8' },
                { label: 'Reserved (awaiting)', value: todayReserved.length, max: data.metrics.capacity, color: '#a78bfa' },
                { label: 'Available slots', value: Math.max(0, data.metrics.capacity - data.metrics.occupancy - todayReserved.length), max: data.metrics.capacity, color: '#34d399' },
              ].map(({ label, value, max, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <span className="font-bold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, boxShadow: `0 0 8px ${color}55` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Incidents */}
          {incidents.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${hasCritical ? 'rgba(244,63,94,0.35)' : 'rgba(245,158,11,0.25)'}`, background: hasCritical ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.04)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: hasCritical ? 'rgba(244,63,94,0.18)' : 'rgba(245,158,11,0.15)' }}>
                <BadgeAlert className="w-3.5 h-3.5" style={{ color: hasCritical ? '#fda4af' : '#fcd34d' }} />
                <span className="text-[11px] font-bold text-white">Open Incidents</span>
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: hasCritical ? 'rgba(244,63,94,0.20)' : 'rgba(245,158,11,0.20)', color: hasCritical ? '#fda4af' : '#fcd34d' }}>
                  {incidents.length}
                </span>
              </div>
              {incidents.slice(0, 3).map((i) => {
                const sev = INCIDENT_SEVERITY_STYLES[i.severity as keyof typeof INCIDENT_SEVERITY_STYLES];
                return (
                  <div key={i.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: sev?.dot ?? '#ef4444' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{i.title}</p>
                      <p className="text-[10px]" style={{ color: sev?.text ?? '#fda4af' }}>{i.severity} · {formatTime(i.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-2.5">
                <Link href="/pos/swimming-pool/safety" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: hasCritical ? '#fda4af' : '#fcd34d' }}>
                  Manage incidents <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Quick nav shortcuts */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(10,18,32,0.85)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-2" style={{ color: '#475569' }}>Navigate</p>
            {[
              { href: '/pos/swimming-pool/occupancy', label: 'Live Occupancy', icon: Activity, color: '#38bdf8' },
              { href: '/pos/swimming-pool/resources', label: 'Resources', icon: Wind, color: '#34d399' },
              { href: '/pos/swimming-pool/reports', label: 'Reports & Analytics', icon: TrendingUp, color: '#a78bfa' },
              { href: '/pos/swimming-pool/shift', label: 'End Shift', icon: Zap, color: '#fcd34d' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link key={href} href={href} className="flex items-center gap-3 px-4 py-2.5 border-t transition-colors hover:bg-white/4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-[12px] font-semibold text-white flex-1">{label}</span>
                <ChevronRight className="w-3 h-3" style={{ color: '#475569' }} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* New Admission Dialog */}
      {showAdmission && (
        <NewAdmissionDialog
          data={data}
          onClose={() => setShowAdmission(false)}
          onSuccess={() => { setShowAdmission(false); load(); }}
        />
      )}
    </div>
  );
}

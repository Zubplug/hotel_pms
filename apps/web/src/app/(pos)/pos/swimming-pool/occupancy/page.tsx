'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, RefreshCw, Loader2, Activity, TrendingUp,
  TrendingDown, ArrowUp, ArrowDown, Clock, Waves,
  UserCheck, UserX,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { occupancyPct, occupancyColour, formatDateTime, POOL_API } from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface OccupancyEntry {
  id: string;
  entryNumber: string;
  status: string;
  guestCount: number;
  admittedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  guest: { firstName: string; lastName: string } | null;
  passType: { name: string; guestClass: string };
}

interface HourlyBucket {
  hour: string;
  label: string;
  occupancy: number;
  entries: number;
  exits: number;
}

function buildHourlyTimeline(entries: OccupancyEntry[]): HourlyBucket[] {
  const buckets: Record<number, HourlyBucket> = {};
  const now = new Date();

  // Build 24 hour buckets for today
  for (let h = 0; h <= now.getHours(); h++) {
    const label = new Date(now);
    label.setHours(h, 0, 0, 0);
    buckets[h] = {
      hour: String(h).padStart(2, '0') + ':00',
      label: label.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }),
      occupancy: 0,
      entries: 0,
      exits: 0,
    };
  }

  // Count entries and exits per hour
  for (const e of entries) {
    if (e.admittedAt) {
      const h = new Date(e.admittedAt).getHours();
      if (buckets[h]) { buckets[h].entries += e.guestCount; }
    }
    if (e.exitedAt) {
      const h = new Date(e.exitedAt).getHours();
      if (buckets[h]) { buckets[h].exits += e.guestCount; }
    }
  }

  // Calculate running occupancy
  let running = 0;
  return Object.values(buckets).map((b) => {
    running = Math.max(0, running + b.entries - b.exits);
    return { ...b, occupancy: running };
  });
}

function OccupancyRingLarge({ occupied, capacity }: { occupied: number; capacity: number }) {
  const pct = occupancyPct(occupied, capacity);
  const colour = occupancyColour(pct);
  const size = 140;
  const r = 56;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={colour} strokeWidth={10}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color: colour }}>{pct}%</span>
          <span className="text-[11px]" style={{ color: '#475569' }}>Full</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-black text-white">{occupied}</p>
        <p className="text-[12px]" style={{ color: '#64748b' }}>of {capacity} capacity in pool</p>
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-[12px]" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.name === 'occupancy' ? '#38bdf8' : p.name === 'entries' ? '#34d399' : '#fda4af' }}>
          {p.name.charAt(0).toUpperCase() + p.name.slice(1)}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function OccupancyPage() {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [data, setData] = useState<{ activeEntries: OccupancyEntry[]; todayEntries: OccupancyEntry[]; metrics: { occupancy: number; capacity: number; available: number; admissions: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      const json = isDesktopMode
        ? await provider.pool.getSnapshot('', facilityId)
        : await (async () => {
            const res = await fetch(`${POOL_API}?${params.toString()}`);
            return res.json();
          })();
      setData(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, isDesktopMode, provider.pool]);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  if (!data) return null;

  const { activeEntries, todayEntries, metrics } = data;
  const hourly = buildHourlyTimeline(todayEntries);
  const peakHour = hourly.reduce((best, b) => b.occupancy > best.occupancy ? b : best, hourly[0] ?? { hour: '—', label: '—', occupancy: 0, entries: 0, exits: 0 });
  const totalIn = todayEntries.filter(e => e.admittedAt).reduce((s, e) => s + e.guestCount, 0);
  const totalOut = todayEntries.filter(e => e.exitedAt).reduce((s, e) => s + e.guestCount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ring */}
        <div className="rounded-2xl p-6 flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.70)' }}>
          <OccupancyRingLarge occupied={metrics.occupancy} capacity={metrics.capacity} />
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { l: 'Available', v: metrics.available, icon: Waves, colour: '#38bdf8' },
            { l: 'Today in', v: totalIn, icon: ArrowUp, colour: '#34d399' },
            { l: 'Today out', v: totalOut, icon: ArrowDown, colour: '#94a3b8' },
            { l: 'Admissions', v: metrics.admissions, icon: Users, colour: '#a78bfa' },
            { l: 'Peak today', v: `${peakHour.occupancy} @ ${peakHour.label}`, icon: TrendingUp, colour: '#f59e0b' },
            { l: 'Active now', v: activeEntries.length, icon: Activity, colour: '#fb923c' },
          ].map(({ l, v, icon: Icon, colour }) => (
            <div key={l} className="pool-metric flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${colour}1a` }}>
                <Icon className="w-4 h-4" style={{ color: colour }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{l}</p>
                <p className="text-lg font-black text-white leading-tight">{v}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly chart */}
      <div className="rounded-2xl p-5" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Hourly Occupancy — Today</h3>
            <p className="text-[11px]" style={{ color: '#475569' }}>
              Live count of guests physically inside the pool (ACTIVE entries only)
            </p>
          </div>
          <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={hourly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="occ-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="occupancy" stroke="#38bdf8" strokeWidth={2} fill="url(#occ-gradient)" name="occupancy" dot={false} />
            <Area type="monotone" dataKey="entries" stroke="#34d399" strokeWidth={1.5} fill="none" name="entries" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="exits" stroke="#fda4af" strokeWidth={1.5} fill="none" name="exits" dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[{ c: '#38bdf8', l: 'Occupancy' }, { c: '#34d399', l: 'Entries (dashed)' }, { c: '#fda4af', l: 'Exits (dashed)' }].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1.5 text-[10px]" style={{ color: '#64748b' }}>
              <div className="w-3 h-0.5 rounded-full" style={{ background: c }} />
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Live guest feed */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="pool-live-dot" />
          <span className="text-sm font-bold text-white">Currently Inside ({activeEntries.length})</span>
          <span className="text-[11px]" style={{ color: '#475569' }}>· ACTIVE entries only</span>
        </div>
        {activeEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Waves className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
            <p className="text-sm" style={{ color: '#475569' }}>Pool is empty</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {activeEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                  {e.guest ? `${e.guest.firstName[0]}${e.guest.lastName[0]}` : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {e.guest ? `${e.guest.firstName} ${e.guest.lastName}` : 'Walk-in Guest'}
                  </p>
                  <p className="text-[11px]" style={{ color: '#64748b' }}>
                    {e.passType.name} · {e.guestCount} guest{e.guestCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-mono" style={{ color: '#475569' }}>
                    {e.admittedAt ? formatDateTime(e.admittedAt) : '—'}
                  </p>
                </div>
                <UserCheck className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

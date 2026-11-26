'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  Activity, ArrowLeft, AlertCircle, AlertTriangle, Info, CheckCircle2,
  MonitorDot, Banknote, Users, ShieldAlert, CalendarClock,
  Search, Filter, Download, Clock, ChevronRight,
  Loader2, MoonStar,
} from 'lucide-react';
import { format } from 'date-fns';

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const BG = 'linear-gradient(160deg, #030712 0%, #05090f 55%, #070a18 100%)';
const GLASS = {
  background: 'rgba(7,15,30,0.88)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 48px -12px rgba(0,0,0,0.75)',
};

const SEV_META = {
  CRITICAL: { icon: AlertCircle,   color: '#fb7185', bg: 'rgba(244,63,94,0.08)',   label: 'Critical' },
  WARNING:  { icon: AlertTriangle, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  label: 'Warning' },
  INFO:     { icon: Info,          color: '#64748b', bg: 'rgba(100,116,139,0.08)', label: 'Info' },
  SUCCESS:  { icon: CheckCircle2,  color: '#34d399', bg: 'rgba(52,211,153,0.08)',  label: 'Success' },
};

const CAT_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  FINANCIAL:   { label: 'Financial',   color: '#fbbf24', icon: Banknote },
  SECURITY:    { label: 'Security',    color: '#fb7185', icon: ShieldAlert },
  FRONT_DESK:  { label: 'Front Desk',  color: '#818cf8', icon: Users },
  NIGHT_AUDIT: { label: 'Night Audit', color: '#a78bfa', icon: CalendarClock },
  SYSTEM:      { label: 'System',      color: '#38bdf8', icon: MonitorDot },
};

function relTime(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getShift(dateStr: string) {
  const h = new Date(dateStr).getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'night';
}

type SevKey = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
type SevFilter = 'ALL' | SevKey;

/* ── Stat tile ──────────────────────────────────────────────────────────────── */
function StatTile({
  label, count, icon: Icon, color,
}: {
  label: string; count: number; icon: React.ElementType; color: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-3"
      style={{
        ...GLASS,
        borderColor: `${color}25`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px -12px rgba(0,0,0,0.65), 0 0 50px -20px ${color}28`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: `radial-gradient(ellipse 70% 60% at 85% 20%, ${color}15, transparent)` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
      </div>
      <p className="relative font-mono text-[28px] font-bold leading-none text-white tabular-nums">
        {count}
      </p>
      <div className="relative h-[2px] rounded-full" style={{ background: `${color}50` }} />
    </div>
  );
}

/* ── Event card ──────────────────────────────────────────────────────────────── */
function EventCard({ event }: { event: any }) {
  const sev = (SEV_META as any)[event.severity] || SEV_META.INFO;
  const cat = CAT_META[event.category] || { label: event.category || 'System', color: '#64748b', icon: MonitorDot };
  const SevIcon = sev.icon;
  const CatIcon = cat.icon;

  return (
    <div
      className="relative flex items-start gap-3 overflow-hidden rounded-2xl border p-3.5 transition-all hover:border-opacity-60"
      style={{
        borderColor: `${sev.color}20`,
        background: `${sev.color}05`,
        borderLeft: `3px solid ${sev.color}50`,
      }}
    >
      {/* Severity icon */}
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${sev.color}15`, border: `1px solid ${sev.color}25` }}
      >
        <SevIcon className="h-4 w-4" style={{ color: sev.color }} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-snug text-white">{event.title}</p>
            {event.description && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{event.description}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] font-semibold tabular-nums text-slate-300">
              {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-[9.5px] text-slate-600">{relTime(event.occurredAt)}</p>
          </div>
        </div>

        {/* Meta chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
            style={{ borderColor: `${sev.color}30`, background: `${sev.color}10`, color: sev.color }}
          >
            {sev.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
            style={{ borderColor: `${cat.color}30`, background: `${cat.color}10`, color: cat.color }}
          >
            <CatIcon className="h-2.5 w-2.5" />
            {cat.label}
          </span>
          {event.actorName && (
            <span className="text-[10px] text-slate-600">· {event.actorName}</span>
          )}
          {event.amount != null && event.currency && (
            <span className="ml-auto font-mono text-[12px] font-bold tabular-nums text-white">
              {new Intl.NumberFormat('en', { style: 'currency', currency: event.currency }).format(event.amount)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Activity Client ────────────────────────────────────────────────────── */
function ActivityClient() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const events: any[] = data?.activityFeed || [];
  const businessDate = data?.businessDate ? new Date(data.businessDate) : new Date();

  // Counts by severity
  const sevCounts = useMemo(() => ({
    CRITICAL: events.filter((e) => e.severity === 'CRITICAL').length,
    WARNING:  events.filter((e) => e.severity === 'WARNING').length,
    INFO:     events.filter((e) => e.severity === 'INFO').length,
    SUCCESS:  events.filter((e) => e.severity === 'SUCCESS').length,
  }), [events]);

  // Staff activity
  const staffActivity = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      const name = e.actorName || 'System';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  const maxStaffCount = staffActivity[0]?.[1] || 1;

  // Filtered events
  const filtered = useMemo(() => events.filter((e) => {
    const matchSev = sevFilter === 'ALL' || e.severity === sevFilter;
    const matchCat = catFilter === 'ALL' || e.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.actorName?.toLowerCase().includes(q);
    return matchSev && matchCat && matchSearch;
  }).reverse(), [events, sevFilter, catFilter, search]);

  // Group by shift
  const groups = useMemo(() => {
    const g: Record<string, any[]> = { morning: [], afternoon: [], night: [] };
    filtered.forEach((e) => g[getShift(e.occurredAt)]?.push(e));
    return g;
  }, [filtered]);

  const shiftMeta = {
    morning:   { label: 'Morning Shift',   time: '00:00–12:00', color: '#fbbf24', icon: '🌅' },
    afternoon: { label: 'Afternoon Shift', time: '12:00–18:00', color: '#38bdf8', icon: '☀️' },
    night:     { label: 'Night Shift',     time: '18:00–24:00', color: '#818cf8', icon: '🌙' },
  };

  const uniqueCats = Array.from(new Set(events.map((e) => e.category).filter(Boolean)));

  if (propertyLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(129,140,248,0.10)', border: '1px solid rgba(129,140,248,0.25)' }}>
            <MoonStar className="h-6 w-6 text-indigo-300" />
          </span>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            Loading activity…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full pb-16 pt-4 px-3 sm:px-4 md:px-6" style={{ background: BG }}>
      <div className="mx-auto max-w-[1400px] space-y-5">

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/night-audit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-slate-400 transition-all hover:border-white/20 hover:text-white"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                <Link href="/night-audit" className="hover:text-slate-300 transition-colors">Night Audit</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-300">Event Timeline</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ borderColor: 'rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.10)', boxShadow: '0 0 20px -6px rgba(129,140,248,0.4)' }}
                >
                  <Activity className="h-4.5 w-4.5 h-[18px] w-[18px] text-indigo-300" />
                </span>
                <div>
                  <h1 className="text-[20px] font-bold tracking-tight text-white">
                    Audit Activity Intelligence
                  </h1>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-300">{format(businessDate, 'EEEE, dd MMM yyyy')}</span>
                    {data?.property.name && <> · {data.property.name}</>}
                    {' '}· {events.length} total events
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Export button (UI only) */}
          <button
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-semibold text-slate-400 transition-all hover:border-white/20 hover:text-white"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            title="Export activity report (coming soon)"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>

        {/* ── Summary Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Events"      count={events.length}         icon={Activity}       color="#818cf8" />
          <StatTile label="Critical Events"   count={sevCounts.CRITICAL}    icon={AlertCircle}    color="#fb7185" />
          <StatTile label="Warnings"          count={sevCounts.WARNING}     icon={AlertTriangle}  color="#fbbf24" />
          <StatTile label="Info Events"       count={sevCounts.INFO}        icon={Info}           color="#64748b" />
        </div>

        {/* ── Staff Activity ────────────────────────────────────────────────── */}
        {staffActivity.length > 0 && (
          <div className="rounded-2xl border p-5" style={{ ...GLASS }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}>
                <Users className="h-3.5 w-3.5 text-violet-400" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-white">Activity by Staff</p>
                <p className="text-[11px] text-slate-500">Events logged per team member this shift</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {staffActivity.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold text-white"
                    style={{ background: 'rgba(129,140,248,0.15)' }}
                  >
                    {name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-slate-200 truncate">{name}</span>
                      <span className="font-mono text-[11px] font-bold text-slate-300 ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(count / maxStaffCount) * 100}%`,
                          background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div
            className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              type="text"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] text-white placeholder-slate-600 outline-none"
            />
          </div>

          {/* Severity filter */}
          <div
            className="flex items-center gap-1 rounded-xl border p-1"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}
          >
            {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => {
              const active = sevFilter === sev;
              const meta = sev !== 'ALL' ? (SEV_META as any)[sev] : null;
              return (
                <button
                  key={sev}
                  onClick={() => setSevFilter(sev)}
                  className="rounded-lg px-3 py-1 text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                    color: active ? (meta?.color || 'white') : '#64748b',
                  }}
                >
                  {sev === 'ALL' ? 'All' : (SEV_META as any)[sev]?.label}
                </button>
              );
            })}
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['ALL', ...uniqueCats]).map((cat) => {
              const m = cat !== 'ALL' ? CAT_META[cat] : null;
              const active = catFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold transition-all"
                  style={{
                    borderColor: active ? (m?.color ? `${m.color}40` : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.06)',
                    background: active ? (m?.color ? `${m.color}12` : 'rgba(255,255,255,0.08)') : 'transparent',
                    color: active ? (m?.color || 'white') : '#64748b',
                  }}
                >
                  {m && <m.icon className="h-3 w-3" />}
                  {cat === 'ALL' ? 'All categories' : m?.label ?? cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result count */}
        <p className="text-[11.5px] text-slate-500">
          Showing <span className="font-semibold text-slate-300">{filtered.length}</span> of {events.length} events
        </p>

        {/* ── Timeline (grouped by shift) ───────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border py-16 text-center"
            style={{ ...GLASS }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)' }}>
              <Activity className="h-6 w-6 text-slate-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-300">No events match your filters</p>
              <button
                onClick={() => { setSearch(''); setSevFilter('ALL'); setCatFilter('ALL'); }}
                className="mt-2 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {(['morning', 'afternoon', 'night'] as const).map((shift) => {
              const shiftEvents = groups[shift];
              if (!shiftEvents || shiftEvents.length === 0) return null;
              const meta = shiftMeta[shift];
              return (
                <div key={shift}>
                  {/* Shift divider */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-base">{meta.icon}</span>
                    <div>
                      <p className="text-[12px] font-bold text-white">{meta.label}</p>
                      <p className="text-[10px] text-slate-500">{meta.time} · {shiftEvents.length} events</p>
                    </div>
                    <div className="flex-1 h-px ml-2" style={{ background: `linear-gradient(90deg, ${meta.color}30, transparent)` }} />
                  </div>

                  {/* Events */}
                  <div className="space-y-2">
                    {shiftEvents.map((event: any) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page export (server wrapper) ───────────────────────────────────────────── */
export default function ActivityPage() {
  return <ActivityClient />;
}

import React, { useState } from 'react';
import {
  Activity, AlertTriangle, Info, AlertCircle, CalendarClock,
  ShieldAlert, MonitorDot, Banknote, Users, Filter
} from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

type Category = 'ALL' | 'FINANCIAL' | 'SECURITY' | 'FRONT_DESK' | 'NIGHT_AUDIT' | 'SYSTEM';
type Severity = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  FINANCIAL: { icon: <Banknote className="h-3.5 w-3.5" />, label: 'Financial', color: '#f59e0b' },
  SECURITY: { icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Security', color: '#f43f5e' },
  FRONT_DESK: { icon: <Users className="h-3.5 w-3.5" />, label: 'Front Desk', color: '#6366f1' },
  NIGHT_AUDIT: { icon: <CalendarClock className="h-3.5 w-3.5" />, label: 'Night Audit', color: '#8b5cf6' },
  SYSTEM: { icon: <MonitorDot className="h-3.5 w-3.5" />, label: 'System', color: '#0ea5e9' },
};

const SEVERITY_META = {
  CRITICAL: {
    icon: <AlertCircle className="h-4 w-4" />,
    nodeColor: '#f43f5e',
    nodeBg: 'bg-rose-500',
    badge: 'border-rose-400/30 bg-rose-400/[0.08] text-rose-300',
    cardBg: 'border-rose-400/[0.12] bg-rose-400/[0.04]',
    label: 'Critical',
  },
  WARNING: {
    icon: <AlertTriangle className="h-4 w-4" />,
    nodeColor: '#f59e0b',
    nodeBg: 'bg-amber-500',
    badge: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300',
    cardBg: 'border-amber-400/[0.10] bg-amber-400/[0.03]',
    label: 'Warning',
  },
  INFO: {
    icon: <Info className="h-4 w-4" />,
    nodeColor: '#475569',
    nodeBg: 'bg-slate-600',
    badge: 'border-slate-600/30 bg-slate-600/[0.08] text-slate-400',
    cardBg: 'border-white/[0.06] bg-white/[0.02]',
    label: 'Info',
  },
};

const getRelativeTime = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all duration-150 ${
        active
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
          : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-white/[0.12] hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

export function ActivityFeed({ data }: { data: NightAuditData }) {
  const events = data.activityFeed || [];
  const [categoryFilter, setCategoryFilter] = useState<Category>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity>('ALL');

  const filtered = events.filter((e) => {
    const catOk = categoryFilter === 'ALL' || e.category === categoryFilter;
    const sevOk = severityFilter === 'ALL' || e.severity === severityFilter;
    return catOk && sevOk;
  });

  const uniqueCategories = Array.from(new Set(events.map((e) => e.category)));

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col rounded-[24px] border border-white/[0.06] p-6 sm:p-8"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Audit Event Timeline</h3>
            <p className="text-[11px] text-slate-500">Real-time operational log</p>
          </div>
        </div>
        <div className="mt-8 flex flex-1 min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07] py-12">
          <MonitorDot className="h-10 w-10 text-slate-700" />
          <p className="mt-4 text-sm font-semibold text-slate-400">No events recorded yet</p>
          <p className="mt-1 text-xs text-slate-600">Activity logged during this shift will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-[24px] border border-white/[0.06] overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header */}
      <div className="border-b border-white/[0.05] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Audit Event Timeline</h3>
              <p className="text-[11px] text-slate-500">Real-time operational log</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-slate-400">
              {events.length} events
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-slate-600">
              <Filter className="h-3 w-3" />
              Showing {filtered.length}
            </span>
          </div>
        </div>

        {/* Filter row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={severityFilter === 'ALL' && categoryFilter === 'ALL'} onClick={() => { setSeverityFilter('ALL'); setCategoryFilter('ALL'); }}>
            All
          </FilterChip>
          <FilterChip active={severityFilter === 'CRITICAL'} onClick={() => setSeverityFilter(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}>
            🔴 Critical
          </FilterChip>
          <FilterChip active={severityFilter === 'WARNING'} onClick={() => setSeverityFilter(severityFilter === 'WARNING' ? 'ALL' : 'WARNING')}>
            🟡 Warning
          </FilterChip>
          <FilterChip active={severityFilter === 'INFO'} onClick={() => setSeverityFilter(severityFilter === 'INFO' ? 'ALL' : 'INFO')}>
            ℹ️ Info
          </FilterChip>
          <div className="h-5 w-px bg-white/[0.08] mx-1 self-center" />
          {uniqueCategories.map((cat) => {
            const meta = CATEGORY_META[cat] || { label: cat, color: '#94a3b8' };
            return (
              <FilterChip
                key={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat as Category)}
              >
                {meta.label}
              </FilterChip>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative max-h-[560px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-semibold text-slate-400">No events match filters</p>
            <button
              onClick={() => { setSeverityFilter('ALL'); setCategoryFilter('ALL'); }}
              className="mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="relative px-6 py-5">
            {/* Vertical timeline line */}
            <div
              className="absolute left-[34px] top-5 bottom-5 w-px"
              style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.3) 0%, rgba(255,255,255,0.05) 100%)' }}
            />

            <div className="space-y-4">
              {filtered.map((event, idx) => {
                const sev = event.severity as keyof typeof SEVERITY_META;
                const meta = SEVERITY_META[sev] || SEVERITY_META.INFO;
                const catMeta = CATEGORY_META[event.category] || { label: event.category, color: '#94a3b8', icon: <MonitorDot className="h-3.5 w-3.5" /> };

                return (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Timeline node */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#07090f] ${meta.nodeBg} text-white`}
                        style={{ boxShadow: `0 0 8px ${meta.nodeColor}50` }}
                      >
                        <div className="scale-75">{meta.icon}</div>
                      </div>
                    </div>

                    {/* Event card */}
                    <div
                      className={`flex-1 rounded-2xl border p-4 transition-all duration-150 hover:brightness-110 ${meta.cardBg}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold leading-snug text-white">{event.title}</h4>
                        <div className="shrink-0 text-right">
                          <span className="block font-mono text-[11px] font-semibold tabular-nums text-slate-400">
                            {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="block text-[10px] text-slate-600">{getRelativeTime(event.occurredAt)}</span>
                        </div>
                      </div>

                      {event.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 line-clamp-2">{event.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {/* Severity badge */}
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${meta.badge}`}>
                          {meta.label}
                        </span>

                        {/* Category chip */}
                        <span
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                          style={{
                            borderColor: `${catMeta.color}30`,
                            background: `${catMeta.color}10`,
                            color: catMeta.color,
                          }}
                        >
                          {catMeta.icon}
                          {catMeta.label}
                        </span>

                        {event.actorName && (
                          <span className="text-[10px] text-slate-600 before:mr-1.5 before:text-slate-700 before:content-['·']">
                            {event.actorName}
                          </span>
                        )}

                        {event.amount !== null && event.amount !== undefined && event.currency && (
                          <span className="ml-auto font-mono text-sm font-bold tracking-tight text-white tabular-nums">
                            {new Intl.NumberFormat('en', { style: 'currency', currency: event.currency }).format(event.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

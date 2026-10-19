'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, RefreshCw, Loader2, Filter, Calendar,
  ChevronLeft, ChevronRight, UserCheck, UserX, ShieldCheck,
  AlertTriangle, LayoutGrid, Ticket, CheckCircle2, XCircle,
  CircleDot, Activity,
} from 'lucide-react';
import { formatDateTime } from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface AuditEvent {
  id: string;
  type: string;
  timestamp: string;
  actorId: string | null;
  description: string;
  meta: Record<string, unknown>;
}

const EVENT_TYPES = [
  'ENTRY_CREATED',
  'ENTRY_CHECKED_IN',
  'ENTRY_CHECKED_OUT',
  'ENTRY_CANCELLED',
  'INCIDENT_CREATED',
  'INCIDENT_RESOLVED',
  'SAFETY_CHECK',
  'RESOURCE_BOOKED',
  'RESOURCE_RELEASED',
] as const;

type EventType = typeof EVENT_TYPES[number];

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  ENTRY_CREATED: Ticket,
  ENTRY_CHECKED_IN: UserCheck,
  ENTRY_CHECKED_OUT: UserX,
  ENTRY_CANCELLED: XCircle,
  INCIDENT_CREATED: AlertTriangle,
  INCIDENT_RESOLVED: CheckCircle2,
  SAFETY_CHECK: ShieldCheck,
  RESOURCE_BOOKED: LayoutGrid,
  RESOURCE_RELEASED: CircleDot,
};

const EVENT_COLOURS: Record<EventType, string> = {
  ENTRY_CREATED: '#94a3b8',
  ENTRY_CHECKED_IN: '#34d399',
  ENTRY_CHECKED_OUT: '#64748b',
  ENTRY_CANCELLED: '#fda4af',
  INCIDENT_CREATED: '#ef4444',
  INCIDENT_RESOLVED: '#34d399',
  SAFETY_CHECK: '#38bdf8',
  RESOURCE_BOOKED: '#a78bfa',
  RESOURCE_RELEASED: '#64748b',
};

const EVENT_LABELS: Record<EventType, string> = {
  ENTRY_CREATED: 'Admission Created',
  ENTRY_CHECKED_IN: 'Checked In',
  ENTRY_CHECKED_OUT: 'Checked Out',
  ENTRY_CANCELLED: 'Cancelled',
  INCIDENT_CREATED: 'Incident Reported',
  INCIDENT_RESOLVED: 'Incident Resolved',
  SAFETY_CHECK: 'Safety Check',
  RESOURCE_BOOKED: 'Resource Booked',
  RESOURCE_RELEASED: 'Resource Released',
};

function EventRow({ event }: { event: AuditEvent }) {
  const type = event.type as EventType;
  const Icon = EVENT_ICONS[type] ?? Activity;
  const colour = EVENT_COLOURS[type] ?? '#94a3b8';
  const label = EVENT_LABELS[type] ?? type;

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 group hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Icon */}
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${colour}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: colour }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: colour }}>{label}</span>
        </div>
        <p className="text-[12px] text-white mt-0.5">{event.description}</p>
      </div>

      {/* Timestamp */}
      <div className="text-right shrink-0">
        <p className="text-[11px]" style={{ color: '#475569' }}>
          {formatDateTime(event.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const { provider } = useLodgeCoreProvider();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EventType[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const LIMIT = 100;
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await provider.pool.getAudit({ facilityId: facilityId || '', type: typeFilter.join(','), from: fromDate, to: toDate });
      const allEvents = (json.data ?? []).filter((event: AuditEvent) => !typeFilter.length || typeFilter.includes(event.type as EventType));
      setTotal(allEvents.length);
      setEvents(allEvents.slice((page - 1) * LIMIT, page * LIMIT));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, provider.pool, typeFilter, fromDate, toDate, page]);

  useEffect(() => { load(); }, [load]);

  const toggleType = (t: EventType) => {
    setTypeFilter(typeFilter.includes(t) ? typeFilter.filter((x) => x !== t) : [...typeFilter, t]);
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  // Group events by date for visual separation
  function groupByDate(evs: AuditEvent[]): { date: string; events: AuditEvent[] }[] {
    const map: Record<string, AuditEvent[]> = {};
    for (const e of evs) {
      const d = new Date(e.timestamp).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!map[d]) map[d] = [];
      map[d].push(e);
    }
    return Object.entries(map).map(([date, events]) => ({ date, events }));
  }

  const grouped = groupByDate(events);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-start gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(6,11,19,0.60)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {EVENT_TYPES.map((t) => {
            const Icon = EVENT_ICONS[t];
            const active = typeFilter.includes(t);
            const colour = EVENT_COLOURS[t];
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all"
                style={{
                  background: active ? `${colour}18` : 'rgba(255,255,255,0.05)',
                  color: active ? colour : '#64748b',
                  border: `1px solid ${active ? `${colour}35` : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                <Icon className="w-3 h-3" />
                {EVENT_LABELS[t].split(' ')[0]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-lg text-[11px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}
          />
          <span className="text-[10px]" style={{ color: '#475569' }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-lg text-[11px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}
          />
          <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Count & pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-[11px]" style={{ color: '#475569' }}>
          {loading ? 'Loading…' : `${total} event${total !== 1 ? 's' : ''}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px]" style={{ color: '#64748b' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ScrollText className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
            <p className="text-sm" style={{ color: '#475569' }}>No audit events found for this period</p>
          </div>
        ) : (
          grouped.map(({ date, events: dayEvents }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(6,11,19,0.90)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Calendar className="w-3 h-3" style={{ color: '#475569' }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{date}</span>
                <span className="text-[10px]" style={{ color: '#334155' }}>· {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="rounded-none">
                {dayEvents.map((e) => <EventRow key={e.id} event={e} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';
import React, { useState } from 'react';
import {
  Activity, AlertTriangle, AlertCircle, Info, CalendarClock,
  ShieldAlert, MonitorDot, Banknote, Users, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { Panel, PanelHeader, Tabs, EmptyState, Badge, cx, TONE_HEX } from './ui';

type Category = 'ALL' | 'FINANCIAL' | 'SECURITY' | 'FRONT_DESK' | 'NIGHT_AUDIT' | 'SYSTEM';
type Severity = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO';

const CAT_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  FINANCIAL: { label: 'Financial', color: TONE_HEX.amber, icon: Banknote },
  SECURITY: { label: 'Security', color: TONE_HEX.rose, icon: ShieldAlert },
  FRONT_DESK: { label: 'Front Desk', color: TONE_HEX.indigo, icon: Users },
  NIGHT_AUDIT: { label: 'Night Audit', color: TONE_HEX.violet, icon: CalendarClock },
  SYSTEM: { label: 'System', color: TONE_HEX.sky, icon: MonitorDot },
};

const SEV_META = {
  CRITICAL: { icon: AlertCircle, color: TONE_HEX.rose, label: 'Critical' },
  WARNING: { icon: AlertTriangle, color: TONE_HEX.amber, label: 'Warning' },
  INFO: { icon: Info, color: '#64748b', label: 'Info' },
};

const relTime = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const INITIAL_SHOW = 8;

export function ActivityFeed({ data }: { data: NightAuditData }) {
  const events = data.activityFeed || [];
  const [sevFilter, setSevFilter] = useState<Severity>('ALL');
  const [catFilter, setCatFilter] = useState<Category>('ALL');
  const [expanded, setExpanded] = useState(false);

  const filtered = events.filter((e: any) =>
    (sevFilter === 'ALL' || e.severity === sevFilter) &&
    (catFilter === 'ALL' || e.category === catFilter),
  );
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOW);
  const uniqueCats = Array.from(new Set(events.map((e: any) => e.category as Category)));

  return (
    <Panel>
      <PanelHeader
        icon={Activity}
        title="Event Timeline"
        subtitle="Operational log for this business date"
        tone="indigo"
        count={events.length}
        actions={
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-slate-600" />
            <Tabs<Severity>
              value={sevFilter}
              onChange={setSevFilter}
              items={[
                { key: 'ALL', label: 'All' },
                { key: 'CRITICAL', label: 'Critical', count: events.filter((e: any) => e.severity === 'CRITICAL').length, tone: 'rose' },
                { key: 'WARNING', label: 'Warn', count: events.filter((e: any) => e.severity === 'WARNING').length, tone: 'amber' },
                { key: 'INFO', label: 'Info' },
              ]}
            />
          </div>
        }
      />

      {/* Category filter */}
      {uniqueCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.05] px-4 py-2">
          {(['ALL', ...uniqueCats] as (Category | 'ALL')[]).map((cat) => {
            const m = cat !== 'ALL' ? CAT_META[cat] : null;
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(cat as Category)}
                className={cx(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold transition-colors',
                  active ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/[0.06] bg-transparent text-slate-500 hover:text-slate-300',
                )}
              >
                {m && <m.icon className="h-3 w-3" style={{ color: active ? m.color : undefined }} />}
                {cat === 'ALL' ? 'All' : m?.label ?? cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {events.length === 0 ? (
          <EmptyState icon={MonitorDot} title="No events yet" hint="Activity logged during this shift will appear here." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-[12px] text-slate-400">No events match filters</p>
            <button onClick={() => { setSevFilter('ALL'); setCatFilter('ALL'); }} className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300">Clear filters</button>
          </div>
        ) : (
          <div className="relative px-4 py-3">
            {/* Timeline spine */}
            <div className="absolute left-[26px] top-3 bottom-3 w-px bg-gradient-to-b from-indigo-500/20 via-white/5 to-transparent" />
            <div className="space-y-2">
              {visible.map((event: any) => {
                const sev = SEV_META[event.severity as keyof typeof SEV_META] || SEV_META.INFO;
                const cat = CAT_META[event.category] || { label: event.category, color: '#64748b', icon: MonitorDot };
                const SevIcon = sev.icon;
                const CatIcon = cat.icon;
                return (
                  <div key={event.id} className="relative flex items-start gap-3">
                    {/* Node */}
                    <div
                      className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#0b111e]/80"
                      style={{ background: `${sev.color}20`, boxShadow: `0 0 0 1px ${sev.color}30` }}
                    >
                      <SevIcon className="h-3 w-3" style={{ color: sev.color }} />
                    </div>
                    {/* Card */}
                    <div className="flex-1 rounded-lg border border-white/[0.05] bg-white/[0.018] px-3 py-2 transition-colors hover:bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-semibold leading-snug text-white">{event.title}</p>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-[10px] font-semibold tabular-nums text-slate-400">
                            {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[9.5px] text-slate-600">{relTime(event.occurredAt)}</p>
                        </div>
                      </div>
                      {event.description && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 line-clamp-2">{event.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                          style={{ borderColor: `${sev.color}30`, background: `${sev.color}10`, color: sev.color }}>
                          {sev.label}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                          style={{ borderColor: `${cat.color}30`, background: `${cat.color}10`, color: cat.color }}>
                          <CatIcon className="h-2.5 w-2.5" />{cat.label}
                        </span>
                        {event.actorName && <span className="text-[10px] text-slate-600">· {event.actorName}</span>}
                        {event.amount != null && event.currency && (
                          <span className="ml-auto font-mono text-[12px] font-bold tabular-nums text-white">
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

      {/* Expand / collapse */}
      {filtered.length > INITIAL_SHOW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.05] py-2.5 text-[11.5px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.03] hover:text-white"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Show less' : `Show ${filtered.length - INITIAL_SHOW} more events`}
        </button>
      )}
    </Panel>
  );
}

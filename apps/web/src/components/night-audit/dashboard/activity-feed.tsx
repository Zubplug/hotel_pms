import React from 'react';
import { Activity, AlertTriangle, Info, AlertCircle, CalendarClock, ShieldAlert, MonitorDot, Banknote, Users } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'FINANCIAL': return <Banknote className="h-4 w-4" />;
    case 'SECURITY': return <ShieldAlert className="h-4 w-4" />;
    case 'FRONT_DESK': return <Users className="h-4 w-4" />;
    case 'NIGHT_AUDIT': return <CalendarClock className="h-4 w-4" />;
    default: return <MonitorDot className="h-4 w-4" />;
  }
};

const severityMeta = {
  CRITICAL: {
    icon: <AlertCircle className="h-3.5 w-3.5 text-rose-400" />,
    iconBg: 'border-rose-400/20 bg-rose-400/10 text-rose-400',
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    label: 'Critical',
  },
  WARNING: {
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
    iconBg: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    label: 'Warning',
  },
  INFO: {
    icon: <Info className="h-3.5 w-3.5 text-slate-400" />,
    iconBg: 'border-slate-600/40 bg-slate-600/15 text-slate-400',
    badge: 'border-slate-600/30 bg-slate-600/10 text-slate-400',
    border: 'border-l-slate-600',
    dot: 'bg-slate-500',
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

export function ActivityFeed({ data }: { data: NightAuditData }) {
  const events = data.activityFeed || [];

  if (events.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Operational Audit Feed</h3>
            <p className="text-[11px] text-slate-500">Real-time event log</p>
          </div>
        </div>
        <div className="mt-6 flex flex-1 min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07]">
          <MonitorDot className="h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-400">No significant events recorded</p>
          <p className="mt-1 text-xs text-slate-600">Activity logged today will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-[600px] flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] backdrop-blur-md">
      {/* Sticky header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Operational Audit Feed</h3>
            <p className="text-[11px] text-slate-500">Real-time event log</p>
          </div>
        </div>
        <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-slate-400">
          {events.length} events
        </span>
      </div>

      {/* Scrollable event list */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-white/[0.04]">
          {events.map((event) => {
            const sev = event.severity as keyof typeof severityMeta;
            const meta = severityMeta[sev] || severityMeta.INFO;

            return (
              <div
                key={event.id}
                className={`group flex items-start gap-4 border-l-2 px-5 py-4 transition-colors hover:bg-white/[0.03] ${meta.border}`}
              >
                {/* Category icon */}
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg}`}>
                  {getCategoryIcon(event.category)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">{event.title}</h4>
                    <div className="shrink-0 text-right">
                      <span className="block text-[11px] font-medium tabular-nums text-slate-400">
                        {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="block text-[10px] text-slate-600">{getRelativeTime(event.occurredAt)}</span>
                    </div>
                  </div>

                  {event.description && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-400 line-clamp-2">{event.description}</p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${meta.badge}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      {event.category.replace('_', ' ')}
                    </span>
                    {event.actorName && (
                      <span className="text-[11px] text-slate-600 before:mr-1.5 before:text-slate-700 before:content-['·']">
                        {event.actorName}
                      </span>
                    )}
                    {event.amount !== null && event.currency && (
                      <span className="ml-auto text-sm font-bold tracking-tight text-white">
                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: event.currency }).format(event.amount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

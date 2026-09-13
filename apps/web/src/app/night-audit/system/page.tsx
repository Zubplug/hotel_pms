'use client';

import React, { useEffect, useState } from 'react';
import {
  RefreshCw, Activity, CheckCircle2, AlertCircle, Loader2,
  ServerCrash, ArrowRight, ShieldAlert, Server, Clock,
  Database, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getSystemHealth } from '@/lib/night-audit-actions';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };
const GLASS = { background: 'rgba(255,255,255,0.025)' };

/* ── Payload display panel ── */
const PayloadDisplay = ({
  payload, title, subtitle, accent = false,
}: { payload: any; title: string; subtitle: string; accent?: boolean }) => {
  if (!payload) return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-6 text-center" style={GLASS}>
      <ServerCrash className="mb-2 h-6 w-6 text-slate-600" />
      <span className="text-sm italic text-slate-600">{title} not available</span>
    </div>
  );

  const formatKey = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border ${accent ? 'border-indigo-400/20' : 'border-white/[0.06]'}`}
      style={{ background: accent ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.025)' }}>
      <div className={`border-b px-4 py-3 ${accent ? 'border-indigo-400/15' : 'border-white/[0.06]'}`}
        style={{ background: accent ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)' }}>
        <h4 className={`text-sm font-bold ${accent ? 'text-indigo-200' : 'text-white'}`}>{title}</h4>
        <p className={`mt-0.5 text-[11px] ${accent ? 'text-indigo-400/70' : 'text-slate-500'}`}>{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{formatKey(key)}</span>
              <span className={`break-all text-xs font-semibold sm:text-right ${accent ? 'text-indigo-200' : 'text-slate-300'}`}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function SystemSyncPage() {
  const { propertyId } = useProperty();
  const { isOnline, isDesktopMode } = useLodgeCoreProvider();
  const isDesktopApp = HardwareBridge.isAvailable();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchConflicts = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/v1/sync/conflicts?propertyId=${propertyId}`);
      if (res.ok) setConflicts(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    Promise.all([getSystemHealth(propertyId).then(setData), fetchConflicts()]).then(() => setLoading(false));
  }, [propertyId]);

  const handleResolve = async (id: string, action: string) => {
    if (!confirm('Are you sure? No silent financial adjustments are made — this enforces the selected state as authoritative.')) return;
    setResolvingId(id);
    try {
      const res = await fetch(`/api/v1/sync/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolutionComment: 'Manual resolution via Night Audit' }),
      });
      const result = await res.json();
      if (res.ok) { toast.success('Conflict resolved successfully.'); fetchConflicts(); }
      else toast.error(`Resolution Failed: ${result.error}`);
    } catch { toast.error('Server error during resolution.'); }
    finally { setResolvingId(null); }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" style={PAGE_BG}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/20"
        style={{ background: 'rgba(99,102,241,0.12)', boxShadow: '0 0 32px rgba(99,102,241,0.2)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
      <p className="animate-pulse text-sm font-medium text-slate-500">Loading system diagnostics…</p>
    </div>
  );

  const failedEvents = (data?.outboxFailed || 0) + (data?.integrationErrors || 0);
  const pendingRetry = data?.outboxPending || 0;

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8" style={PAGE_BG}>
      <div className="mx-auto max-w-[1200px] space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Night Audit / Insights
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(99,102,241,0.15))', boxShadow: '0 0 24px rgba(14,165,233,0.18)' }}
              >
                <Server className="h-5 w-5 text-sky-300" />
              </span>
              System &amp; Sync
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Monitor hardware bridges, resolve edge synchronization conflicts, and maintain data integrity.
            </p>
          </div>
        </header>

        {/* ── Interface Status ── */}
        <section className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={GLASS}>
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Activity className="h-4 w-4 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Interface Status</h2>
              <p className="text-[11px] text-slate-500">Live connection status for hardware agents and integrations</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {/* Desktop app */}
            {isDesktopApp && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">LodgeCore Desktop (Local)</p>
                    <p className="text-xs text-emerald-400/70">Direct hardware connection active</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300">Connected</span>
              </div>
            )}

            {/* Hardware agents */}
            {data?.hardware?.map((agent: any) => (
              <div key={agent.id} className={`rounded-2xl border px-4 py-3 transition-all ${agent.status === 'ONLINE' ? 'border-emerald-400/20 bg-emerald-400/[0.05]' : 'border-rose-400/20 bg-rose-400/[0.05]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm ${agent.status === 'ONLINE' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400' : 'border-rose-400/20 bg-rose-400/10 text-rose-400'}`}>
                      {agent.status === 'ONLINE' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{agent.name}</p>
                      <p className="text-xs text-slate-500">Last seen: Just now</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${agent.status === 'ONLINE' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/30 bg-rose-400/10 text-rose-300'}`}>
                    {agent.status === 'ONLINE' ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div className={cn('h-full w-full rounded-full transition-all duration-500', agent.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-400')} />
                </div>
              </div>
            ))}

            {!data?.hardware?.length && !isDesktopApp && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-10 text-center">
                <Server className="mb-2 h-8 w-8 text-slate-700" />
                <span className="text-sm font-medium text-slate-600">No hardware agents configured.</span>
              </div>
            )}

            {/* Sync queue */}
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border text-sm', data?.syncConflicts > 0 ? 'border-amber-400/20 bg-amber-400/10 text-amber-400' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400')}>
                  {data?.syncConflicts > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Offline Sync Queue</p>
                  <p className="text-xs text-slate-500">Pending events waiting to synchronize</p>
                </div>
              </div>
              <span className={cn('text-lg font-black tabular-nums', data?.syncConflicts > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                {data?.syncConflicts || 0} Pending
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className={cn('h-full rounded-full transition-all duration-700', data?.syncConflicts > 0 ? 'bg-gradient-to-r from-amber-400 to-orange-400 w-[45%]' : 'bg-gradient-to-r from-emerald-400 to-emerald-500 w-full')} />
            </div>
          </div>
        </section>

        {/* ── Integration Health Metrics ── */}
        <section className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={GLASS}>
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Database className="h-4 w-4 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Integration Health</h2>
              <p className="text-[11px] text-slate-500">Key metrics for pending financial operations and system sync</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.05] sm:grid-cols-4 sm:divide-y-0">
            {[
              {
                label: 'Last Sync',
                value: data?.lastSync ? new Date(data.lastSync).toLocaleTimeString() : 'Never',
                icon: RefreshCw,
                color: 'text-sky-300',
                bg: 'bg-sky-400/10',
                border: 'border-sky-400/20',
              },
              {
                label: 'Open POS Orders',
                value: String(data?.posOrdersOpen || 0),
                icon: AlertTriangle,
                color: data?.posOrdersOpen > 0 ? 'text-amber-300' : 'text-emerald-300',
                bg: data?.posOrdersOpen > 0 ? 'bg-amber-400/10' : 'bg-emerald-400/10',
                border: data?.posOrdersOpen > 0 ? 'border-amber-400/20' : 'border-emerald-400/20',
              },
              {
                label: 'Failed Events',
                value: String(failedEvents),
                icon: ServerCrash,
                color: failedEvents > 0 ? 'text-rose-300' : 'text-emerald-300',
                bg: failedEvents > 0 ? 'bg-rose-400/10' : 'bg-emerald-400/10',
                border: failedEvents > 0 ? 'border-rose-400/20' : 'border-emerald-400/20',
              },
              {
                label: 'Retrying / Pending',
                value: `${pendingRetry} (${data?.retryStatus || 0} retrying)`,
                icon: Clock,
                color: pendingRetry > 0 ? 'text-amber-300' : 'text-emerald-300',
                bg: pendingRetry > 0 ? 'bg-amber-400/10' : 'bg-emerald-400/10',
                border: pendingRetry > 0 ? 'border-amber-400/20' : 'border-emerald-400/20',
              },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className="flex flex-col gap-3 p-5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${bg} ${border} ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className={`mt-1 text-xl font-black tabular-nums ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sync Conflicts ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-slate-400">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">Synchronization Conflicts</h2>
                <p className="text-sm text-slate-500">Review and resolve offline structural conflicts</p>
              </div>
            </div>
            {conflicts.length > 0 && (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-1.5 text-xs font-bold text-rose-300">
                {conflicts.length} Action{conflicts.length !== 1 && 's'} Required
              </span>
            )}
          </div>

          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-emerald-400/20 py-16 text-center" style={{ background: 'rgba(16,185,129,0.05)' }}>
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white">System Healthy</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">All edge devices are perfectly in sync. No active synchronization conflicts requiring resolution.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {conflicts.map(conflict => {
                const isCritical = conflict.severity === 'CRITICAL';
                return (
                  <div key={conflict.id} className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={GLASS}>
                    {/* Severity strip */}
                    <div className={`h-1 w-full ${isCritical ? 'bg-gradient-to-r from-rose-500 to-red-400' : 'bg-gradient-to-r from-slate-500 to-slate-400'}`} />

                    {/* Header */}
                    <div className="border-b border-white/[0.06] px-6 py-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold capitalize text-white">
                              {conflict.edgeEvent.eventType.toLowerCase().replace(/_/g, ' ')}
                            </h3>
                            <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-bold', isCritical ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-slate-600/30 bg-slate-600/10 text-slate-400')}>
                              {conflict.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            <span className="capitalize">{conflict.aggregateType.toLowerCase()}</span> · {conflict.aggregateId}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-1.5 text-[10px] font-semibold sm:items-end">
                          <span className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-slate-400">
                            Cloud Version <span className="font-black text-white">v{conflict.expectedVersion}</span>
                          </span>
                          <span className="rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-indigo-300">
                            Edge Version <span className="font-black">v{conflict.receivedVersion}</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <Activity className="h-2.5 w-2.5" />
                            {new Date(conflict.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="space-y-4 px-6 py-5">
                      {/* Conflict reason */}
                      <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-4">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                        <div>
                          <h4 className="font-bold text-rose-200">Conflict Reason</h4>
                          <p className="mt-1 text-sm text-rose-300/80 leading-relaxed">{conflict.conflictReason}</p>
                        </div>
                      </div>

                      {/* Financial impact warning */}
                      {isCritical && (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <h4 className="font-bold text-amber-200">Financial Impact Detected</h4>
                            <p className="mt-1 text-sm text-amber-300/80 leading-relaxed">
                              Review the payload carefully. No financial adjustment has been silently applied. You must manually force or discard this action.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Payload comparison */}
                      <div className="grid gap-4 lg:grid-cols-2">
                        <PayloadDisplay
                          title={`Cloud State (v${conflict.expectedVersion})`}
                          subtitle="Authoritative server state before event"
                          payload={conflict.cloudState}
                        />
                        <div className="hidden lg:flex items-center justify-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-500">
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                        <PayloadDisplay
                          title={`Edge State (v${conflict.receivedVersion})`}
                          subtitle="Conflicting offline event data"
                          payload={conflict.edgeEvent.payload}
                          accent
                        />
                      </div>

                      {/* Resolution actions */}
                      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:flex-row">
                        <p className="text-sm font-semibold text-slate-400">Select a resolution strategy:</p>
                        <div className="flex w-full gap-3 sm:w-auto">
                          <button
                            disabled={resolvingId === conflict.id}
                            onClick={() => handleResolve(conflict.id, 'REJECT_EDGE_EVENT')}
                            className="flex-1 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-300 transition-all hover:bg-rose-400/20 disabled:opacity-50 sm:flex-none"
                          >
                            Discard Edge Event
                          </button>
                          <button
                            disabled={resolvingId === conflict.id}
                            onClick={() => handleResolve(conflict.id, 'FORCE_EDGE_EVENT')}
                            className="flex-1 rounded-xl border border-indigo-400/30 px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 sm:flex-none"
                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                          >
                            Force Apply Event
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

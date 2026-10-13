'use client';

import React, { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2,
  RefreshCcw, TrendingUp, Bed, Percent, Activity,
  Users, LogOut, LogIn, UserX
} from 'lucide-react';

import { StatusBanner } from '@/components/night-audit/dashboard/status-banner';
import { MetricCards } from '@/components/night-audit/dashboard/metric-cards';
import { AuditReadiness } from '@/components/night-audit/dashboard/audit-readiness';
import { OccupancyChart } from '@/components/night-audit/dashboard/occupancy-chart';
import { RevenueTrendChart } from '@/components/night-audit/dashboard/revenue-trend-chart';
import { ActivityFeed } from '@/components/night-audit/dashboard/activity-feed';
import { AttentionQueue } from '@/components/night-audit/dashboard/attention-queue';
import { AuditPulse } from '@/components/night-audit/dashboard/audit-pulse';
import { CloseControl } from '@/components/night-audit/dashboard/close-control';
import { GuestAmenityControl } from '@/components/night-audit/dashboard/guest-amenity-control';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';
import { AuditSuccessModal } from '@/components/night-audit/audit-success-modal';
import { AuditFailureModal } from '@/components/night-audit/audit-failure-modal';

export default function NightAuditDashboard({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [flashData, setFlashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSuccessfulRefresh, setLastSuccessfulRefresh] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  const [wizardOpen, setWizardOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to load audit status');
      setData(result.data);
      setLastSuccessfulRefresh(new Date());

      try {
        const flashRes = await fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${result.data.businessDate}`);
        const flashJson = await flashRes.json();
        if (flashRes.ok) setFlashData(flashJson.data || flashJson);
      } catch (e) {
        console.error('Failed to load flash report:', e);
      }

      if (result.data.auditState === 'OVERDUE' && !quiet && !managerMode) {
        setWizardOpen(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [propertyId]);

  const execute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/night-audit/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Audit execution failed');
      setWizardOpen(false);
      setSuccessResult(result.data);
      await load(true);
    } catch (err: any) {
      setError(err.message);
      setFailureMessage(err.message || 'The Night Audit could not be completed.');
    } finally {
      setExecuting(false);
    }
  };

  const handleQueueResolve = (actionType: string, payload: any) => {
    setResolutionAction({ type: actionType as any, item: payload });
  };

  const handleResolutionSuccess = () => {
    setResolutionAction(null);
    load(true);
  };

  // ── Loading / empty states ──────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#060c18' }}>
      {children}
    </div>
  );

  if (propertyLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm font-medium text-slate-400">Loading workspace…</p>
        </div>
      </Shell>
    );
  }

  if (!propertyId) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-400">
            <MoonStar className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Select a Property</h2>
          <p className="mt-2 text-sm text-slate-500">Choose a property to open the audit workspace.</p>
        </div>
      </Shell>
    );
  }

  if (loading || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm font-medium text-slate-400">Loading audit status…</p>
        </div>
      </Shell>
    );
  }

  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';

  return (
    <div
      className="min-h-full px-3 pb-16 pt-4 sm:px-6 sm:pt-8 md:px-8"
      style={{ background: 'linear-gradient(160deg, #060c18 0%, #080e1f 60%, #0a0c22 100%)' }}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* Operational header: the calendar date and the hotel's business date are deliberately separate. */}
        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b1220]/90 shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-300">
                <MoonStar className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-bold text-white">{data.property.name}</p>
                  <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">Night audit</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Financial operations and business-date control centre</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${data.auditState === 'COMPLETED' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : data.summary.blockers > 0 ? 'border-rose-400/25 bg-rose-400/10 text-rose-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {data.auditState.replaceAll('_', ' ')}
              </span>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                aria-label="Refresh night audit data"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Business date</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">{data.businessDate}</p>
              <p className="mt-1 text-[11px] text-slate-500">The date being reconciled and closed</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Property local time</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">{new Intl.DateTimeFormat('en-GB', { timeZone: data.property.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{data.property.timezone} · calendar date may differ</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Control summary</p>
              <p className="mt-1 text-sm font-bold text-white"><span className={data.summary.blockers ? 'text-rose-300' : 'text-emerald-300'}>{data.summary.blockers} blockers</span><span className="mx-2 text-slate-700">/</span><span className="text-amber-300">{data.summary.warnings} warnings</span></p>
              <p className="mt-1 text-[11px] text-slate-500">Server-evaluated readiness checks</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Data freshness</p>
              <p className="mt-1 text-sm font-bold text-white">{lastSuccessfulRefresh ? lastSuccessfulRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</p>
              <p className={`mt-1 text-[11px] ${error ? 'text-rose-300' : 'text-slate-500'}`}>{error ? 'Refresh failed · displayed data may be stale' : 'Last successful status read'}</p>
            </div>
          </div>
        </div>

        {/* Global Alerts */}
        {(data.auditState === 'FAILED' || error || message) && (
          <div className="space-y-3">
            {data.auditState === 'FAILED' && (
              <div className="flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-5 py-4">
                <div className="flex items-center gap-3 text-rose-300">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold">Last audit failed — review audit logs and retry.</span>
                </div>
                <button
                  onClick={() => load(true)}
                  className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-1.5 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20"
                >
                  Retry
                </button>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-5 py-4 text-sm font-semibold text-rose-300">
                <XCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}
            {message && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {message}
              </div>
            )}
          </div>
        )}

        {/* Hero Status Banner */}
        <StatusBanner
          data={data}
          isAuditInProgress={isAuditInProgress}
          onOpenWizard={() => setWizardOpen(true)}
          refreshing={refreshing}
          managerMode={managerMode}
        />

        {/* Operational Pulse */}
        <AuditPulse data={data} />

        {/* Financial Close Control */}
        <CloseControl data={data} />

        {/* Guest amenity inventory and operating-cost preflight */}
        <GuestAmenityControl data={data} />

        {/* Manager's Flash Report */}
        {flashData && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="border-b border-white/[0.06] p-5 backdrop-blur-md">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Activity className="h-5 w-5 text-indigo-400" /> Manager's Flash & Revenue Analysis
              </h2>
              <p className="mt-1 text-sm text-slate-400">Live operational statistics, revenue breakdowns, and KPIs through the business date.</p>
            </div>
            <div className="grid gap-px bg-white/[0.06] lg:grid-cols-3">
              <div className="bg-[#0a0c22] p-6">
                <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Revenue Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between"><span className="text-sm font-medium text-slate-400">Room Revenue</span><span className="font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.roomRevenue || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-sm font-medium text-slate-400">F&B Revenue</span><span className="font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.fbRevenue || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-sm font-medium text-slate-400">Other Revenue</span><span className="font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.otherRevenue || 0))}</span></div>
                  <div className="my-2 border-t border-white/5"></div>
                  <div className="flex justify-between"><span className="text-sm font-semibold text-slate-300">Net Revenue</span><span className="font-bold text-emerald-400">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.netRevenue || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Taxes</span><span className="font-medium text-slate-400">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.totalTaxes || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Concessions/Discounts</span><span className="font-medium text-rose-400">-{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.totalDiscounts || 0))}</span></div>
                  <div className="mt-2 border-t border-white/10 pt-3"></div>
                  <div className="flex justify-between"><span className="text-base font-bold text-white">Gross Revenue</span><span className="text-base font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.grossRevenue || 0))}</span></div>
                </div>
              </div>
              
              <div className="bg-[#0a0c22] p-6">
                <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Performance Metrics</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-300">Occupancy (OCC)</span><span className="font-bold text-emerald-400">{flashData.occupancyPercentage?.toFixed(1) || '0.0'}%</span></div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(100, flashData.occupancyPercentage || 0)}%` }}></div></div>
                    <div className="mt-2 text-right text-xs font-medium text-slate-500">{flashData.occupiedRooms || 0} / {flashData.totalRooms || 0} rooms</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3"><TrendingUp className="h-6 w-6 text-indigo-400" /><div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">ADR</div><div className="text-lg font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.adr || 0))}</div></div></div>
                    <div className="h-10 w-px bg-white/5"></div>
                    <div className="flex items-center gap-3 text-right"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">RevPAR</div><div className="text-lg font-bold text-white">{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(flashData.revPar || 0))}</div></div><Percent className="h-6 w-6 text-indigo-400" /></div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0a0c22] p-6">
                <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Operational Movement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-center">
                    <LogIn className="mx-auto mb-2 h-6 w-6 text-blue-400" />
                    <div className="text-2xl font-bold text-white">{flashData.arrivals || 0}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Arrivals</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-center">
                    <LogOut className="mx-auto mb-2 h-6 w-6 text-amber-400" />
                    <div className="text-2xl font-bold text-white">{flashData.departures || 0}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Departures</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-center">
                    <Users className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                    <div className="text-2xl font-bold text-white">{flashData.walkIns || 0}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Walk-ins</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-center">
                    <UserX className="mx-auto mb-2 h-6 w-6 text-rose-400" />
                    <div className="text-2xl font-bold text-white">{flashData.noShows || 0}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">No-shows</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Metrics + Chart */}
        <MetricCards data={data} />

        {/* Charts: Occupancy + Revenue Trend */}
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <OccupancyChart rooms={data.analytics.rooms} />
          <RevenueTrendChart trend={data.analytics.trend} baseCurrency={data.property.baseCurrency} />
        </div>

        {/* Readiness + Attention Queue */}
        {data.auditState !== 'COMPLETED' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <AuditReadiness data={data} />
            <AttentionQueue data={data} onResolveItem={managerMode ? undefined : handleQueueResolve} />
          </div>
        )}

        {/* Activity Feed */}
        <ActivityFeed data={data} />

      </div>

      {/* Audit Wizard Modal */}
      {!managerMode && (
        <AuditWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          data={data}
          onExecute={execute}
          executing={executing}
          onRefresh={() => load(true)}
        />
      )}

      {/* Global Resolution Manager */}
      {!managerMode && (
        <ResolutionManager
          action={resolutionAction}
          onClose={() => setResolutionAction(null)}
          onSuccess={handleResolutionSuccess}
        />
      )}

      {/* Success Modal */}
      <AuditSuccessModal 
        open={!!successResult} 
        onOpenChange={(open) => !open && setSuccessResult(null)} 
        result={successResult}
        businessDate={data.businessDate}
      />

      <AuditFailureModal
        open={!!failureMessage}
        onOpenChange={(open) => !open && setFailureMessage(null)}
        message={failureMessage || ''}
        onRetry={execute}
      />
    </div>
  );
}

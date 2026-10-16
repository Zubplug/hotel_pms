'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2,
  RefreshCcw, Activity, TrendingUp, Users, LogOut, LogIn, UserX,
  Hotel, BarChart3
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

/* ── Background canvas ─────────────────────────────────────────────────────── */
const DASHBOARD_BG = 'linear-gradient(160deg, #050a14 0%, #06090f 50%, #070a18 100%)';

/* ── Loading / empty shells ────────────────────────────────────────────────── */
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: DASHBOARD_BG }}
    >
      {children}
    </div>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <CenteredShell>
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 0 40px rgba(99,102,241,0.45)',
          }}
        >
          <MoonStar className="h-7 w-7 text-white" />
          <span className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-indigo-500" />
        </div>
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-indigo-400" />
          <p className="text-sm font-medium text-slate-300">{label}</p>
        </div>
      </div>
    </CenteredShell>
  );
}

/* ── Manager's flash section ───────────────────────────────────────────────── */
function ManagersFlash({ flashData, data }: { flashData: any; data: NightAuditData }) {
  const baseCurrency = data.property.baseCurrency;
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: baseCurrency, maximumFractionDigits: 0 }).format(n);

  const revenueRows = [
    { label: 'Room Revenue', value: Number(flashData.roomRevenue || 0), color: '#6366f1' },
    { label: 'F&B Revenue', value: Number(flashData.fbRevenue || 0), color: '#f59e0b' },
    { label: 'Other Revenue', value: Number(flashData.otherRevenue || 0), color: '#10b981' },
  ];
  const netRevenue = Number(flashData.netRevenue || 0);
  const grossRevenue = Number(flashData.grossRevenue || 0);
  const totalTaxes = Number(flashData.totalTaxes || 0);
  const totalDiscounts = Number(flashData.totalDiscounts || 0);
  const occ = flashData.occupancyPercentage?.toFixed(1) || '0.0';
  const adr = Number(flashData.adr || 0);
  const revPar = Number(flashData.revPar || 0);

  const movements = [
    { label: 'Arrivals', value: flashData.arrivals || 0, icon: LogIn, color: '#6366f1' },
    { label: 'Departures', value: flashData.departures || 0, icon: LogOut, color: '#f59e0b' },
    { label: 'Walk-ins', value: flashData.walkIns || 0, icon: Users, color: '#10b981' },
    { label: 'No-shows', value: flashData.noShows || 0, icon: UserX, color: '#f43f5e' },
  ];

  return (
    <div
      className="overflow-hidden rounded-[24px] border border-white/[0.06]"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/[0.1] text-amber-400">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">Manager's Flash Report</h2>
          <p className="text-[11px] text-slate-500">Live operational statistics and KPIs for the business date</p>
        </div>
      </div>

      {/* 3-col grid */}
      <div className="grid gap-px lg:grid-cols-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {/* Revenue Summary */}
        <div className="p-6" style={{ background: '#07090f' }}>
          <h3 className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Revenue Summary</h3>
          <div className="space-y-3.5">
            {revenueRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-sm font-medium text-slate-400">{row.label}</span>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-white">{fmt(row.value)}</span>
              </div>
            ))}
            <div className="border-t border-white/[0.06] pt-3 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-slate-200">Net Revenue</span>
                <span className="font-mono text-sm font-bold tabular-nums text-emerald-400">{fmt(netRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Taxes</span>
                <span className="font-mono text-xs tabular-nums text-slate-400">{fmt(totalTaxes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Discounts</span>
                <span className="font-mono text-xs tabular-nums text-rose-400">−{fmt(totalDiscounts)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t border-white/[0.08] pt-3">
              <span className="text-base font-bold text-white">Gross Revenue</span>
              <span className="font-mono text-base font-bold tabular-nums text-white">{fmt(grossRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="p-6" style={{ background: '#07090f' }}>
          <h3 className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Performance Metrics</h3>
          <div className="space-y-5">
            {/* Occupancy bar */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-300">Occupancy (OCC)</span>
                <span className="font-bold text-emerald-400">{occ}%</span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, flashData.occupancyPercentage || 0)}%`,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                  }}
                />
              </div>
              <p className="mt-1.5 text-right text-[11px] text-slate-500">
                {flashData.occupiedRooms || 0} / {flashData.totalRooms || 0} rooms
              </p>
            </div>

            {/* ADR / RevPAR tiles */}
            <div
              className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.05] p-4"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ADR</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-white">{fmt(adr)}</p>
              </div>
              <div className="text-center border-l border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">RevPAR</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-white">{fmt(revPar)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Movement */}
        <div className="p-6" style={{ background: '#07090f' }}>
          <h3 className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Operational Movement</h3>
          <div className="grid grid-cols-2 gap-3">
            {movements.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] p-4 text-center transition-all duration-150 hover:border-white/[0.1]"
                  style={{ background: `${m.color}08` }}
                >
                  <Icon className="h-6 w-6 mb-2" style={{ color: m.color }} />
                  <p className="text-2xl font-bold text-white">{m.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: `${m.color}90` }}>{m.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Error / alert banner ──────────────────────────────────────────────────── */
function AlertBanner({
  variant,
  icon: Icon,
  message,
  action,
}: {
  variant: 'error' | 'success' | 'warning';
  icon: React.ElementType;
  message: string;
  action?: React.ReactNode;
}) {
  const styles = {
    error: 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300',
    success: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300',
    warning: 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
  };
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${styles[variant]}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
      {action}
    </div>
  );
}

/* ── Main dashboard ────────────────────────────────────────────────────────── */
export default function NightAuditDashboard({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [flashData, setFlashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
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

  const load = useCallback(async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to load audit status');
      setData(result.data);
      setLastRefresh(new Date());
      const blockers = [
        ...(result.data.system?.openPosSessions || []),
        ...(result.data.system?.openFrontdeskSessions || []),
        ...(result.data.system?.financialSyncConflicts || []),
        ...(result.data.financial?.unverifiedComplimentary || []),
        ...(result.data.financial?.pendingCheckInBypasses || []),
        ...(result.data.cash?.unverifiedTransactions || []),
      ].length;
      const warnings = (result.data.cash?.cashHandovers || []).length + (result.data.operational?.arrivals || []).length;
      window.dispatchEvent(new CustomEvent('night-audit:queue-counts', { detail: {
        '/night-audit': blockers + warnings,
        '/night-audit/ar-ledger': (result.data.financial?.highBalances || []).length,
      }}));

      const hasPersistedAudit = Boolean(result.data.currentAudit);
      if (hasPersistedAudit) {
        try {
          const flashRes = await fetch(
            `/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${result.data.businessDate}`,
            { cache: 'no-store' }
          );
          const flashJson = await flashRes.json();
          if (flashRes.ok) setFlashData(flashJson.data || flashJson);
        } catch (e) {
          console.error('Failed to load flash report:', e);
        }
      } else {
        setFlashData(null);
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
  }, [propertyId, managerMode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refresh = () => { void load(true); };
    window.addEventListener('night-audit:refresh', refresh);
    return () => window.removeEventListener('night-audit:refresh', refresh);
  }, [load]);

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

  // ── Loading states ──────────────────────────────────────────────────────────
  if (propertyLoading) return <LoadingSpinner label="Loading workspace…" />;

  if (!propertyId) {
    return (
      <CenteredShell>
        <div className="text-center px-6">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] border border-indigo-400/20"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
              boxShadow: '0 0 40px rgba(99,102,241,0.2)',
            }}
          >
            <Hotel className="h-10 w-10 text-indigo-300" />
          </div>
          <h2 className="text-2xl font-bold text-white">Select a Property</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
            Choose a property from the selector above to open the night audit workspace.
          </p>
        </div>
      </CenteredShell>
    );
  }

  if (loading || !data) return <LoadingSpinner label="Loading audit status…" />;

  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';

  return (
    <div
      className="min-h-full pb-20 pt-6 px-4 sm:px-6 md:px-8"
      style={{ background: DASHBOARD_BG }}
    >
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* ── Global alerts ───────────────────────────────────────────────── */}
        {(data.auditState === 'FAILED' || error || message) && (
          <div className="space-y-3">
            {data.auditState === 'FAILED' && (
              <AlertBanner
                variant="error"
                icon={AlertTriangle}
                message="Last audit failed — review the audit log and retry."
                action={
                  <button
                    onClick={() => load(true)}
                    className="shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-1.5 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20"
                  >
                    Retry
                  </button>
                }
              />
            )}
            {error && <AlertBanner variant="error" icon={XCircle} message={error} />}
            {message && <AlertBanner variant="success" icon={CheckCircle2} message={message} />}
          </div>
        )}

        {/* ── 1. Status Banner (Hero) ─────────────────────────────────────── */}
        <StatusBanner
          data={data}
          isAuditInProgress={isAuditInProgress}
          onOpenWizard={() => setWizardOpen(true)}
          refreshing={refreshing}
          managerMode={managerMode}
        />

        {/* ── 2. Audit Pulse (4 live KPI tiles) ──────────────────────────── */}
        <AuditPulse data={data} />

        {/* ── 3. Financial Close Control ──────────────────────────────────── */}
        <CloseControl data={data} />

        {/* ── 4. Guest Amenity & Operating Cost preflight ─────────────────── */}
        <GuestAmenityControl data={data} />

        {/* ── 5. Manager's Flash (if audit has been run) ──────────────────── */}
        {flashData && <ManagersFlash flashData={flashData} data={data} />}

        {/* ── 6. Primary Revenue Metrics + 7-day bar chart ────────────────── */}
        <MetricCards data={data} />

        {/* ── 7. Charts row: Occupancy + Revenue Trend ───────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <OccupancyChart rooms={data.analytics.rooms} />
          <RevenueTrendChart trend={data.analytics.trend} baseCurrency={data.property.baseCurrency} />
        </div>

        {/* ── 8. Audit Readiness + Attention Queue (pre-close only) ───────── */}
        {data.auditState !== 'COMPLETED' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <AuditReadiness data={data} />
            <AttentionQueue
              data={data}
              onResolveItem={managerMode ? undefined : handleQueueResolve}
            />
          </div>
        )}

        {/* ── 9. Operational Activity Timeline ───────────────────────────── */}
        <ActivityFeed data={data} />

        {/* ── Data freshness footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-4 text-[11px] text-slate-600">
          <span>
            {lastRefresh
              ? `Last refreshed at ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Awaiting first refresh'}
            {error && <span className="ml-2 text-rose-400">· refresh failed, data may be stale</span>}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
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
      {!managerMode && (
        <ResolutionManager
          action={resolutionAction}
          onClose={() => setResolutionAction(null)}
          onSuccess={handleResolutionSuccess}
        />
      )}
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

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2,
  RefreshCcw, Hotel, Activity, LogIn, LogOut, Users, UserX,
} from 'lucide-react';
import { format } from 'date-fns';

import { StatusBanner } from '@/components/night-audit/dashboard/status-banner';
import { KpiStrip } from '@/components/night-audit/dashboard/kpi-strip';
import { AttentionQueue } from '@/components/night-audit/dashboard/attention-queue';
import { AuditReadiness } from '@/components/night-audit/dashboard/audit-readiness';
import { OccupancyChart } from '@/components/night-audit/dashboard/occupancy-chart';
import { GuestAmenityControl } from '@/components/night-audit/dashboard/guest-amenity-control';
import { CloseControl } from '@/components/night-audit/dashboard/close-control';
import { RevenueTrendChart } from '@/components/night-audit/dashboard/revenue-trend-chart';
import { MetricCards } from '@/components/night-audit/dashboard/metric-cards';
import { ActivityFeed } from '@/components/night-audit/dashboard/activity-feed';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';
import { AuditSuccessModal } from '@/components/night-audit/audit-success-modal';
import { AuditFailureModal } from '@/components/night-audit/audit-failure-modal';
import { Panel, PanelHeader, money, cx, TONE_HEX } from '@/components/night-audit/dashboard/ui';

/* ── Background ─────────────────────────────────────────────────────────────── */
const BG = 'linear-gradient(160deg,#05090f 0%,#060a12 55%,#070a18 100%)';

/* ── Loading shells ──────────────────────────────────────────────────────────── */
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: BG }}>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <CenteredShell>
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/20 to-violet-500/10">
          <MoonStar className="h-5 w-5 text-indigo-300" />
        </span>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          {label}
        </div>
      </div>
    </CenteredShell>
  );
}

/* ── Inline alert strip ──────────────────────────────────────────────────────── */
function AlertStrip({
  variant, icon: Icon, message, action,
}: { variant: 'error' | 'success' | 'warning'; icon: React.ElementType; message: string; action?: React.ReactNode }) {
  const s = {
    error: 'border-rose-400/20 bg-rose-400/[0.05] text-rose-300',
    success: 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300',
    warning: 'border-amber-400/20 bg-amber-400/[0.05] text-amber-300',
  }[variant];
  return (
    <div className={cx('flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold', s)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {action}
    </div>
  );
}

/* ── Manager's Flash compact panel ──────────────────────────────────────────── */
function ManagersFlash({ flashData, data }: { flashData: any; data: NightAuditData }) {
  const cur = data.property.baseCurrency;
  const occ = flashData.occupancyPercentage?.toFixed(1) || '0.0';
  const adr = Number(flashData.adr || 0);
  const revPar = Number(flashData.revPar || 0);
  const movements = [
    { label: 'Arrivals', value: flashData.arrivals || 0, icon: LogIn, color: TONE_HEX.indigo },
    { label: 'Departures', value: flashData.departures || 0, icon: LogOut, color: TONE_HEX.amber },
    { label: 'Walk-ins', value: flashData.walkIns || 0, icon: Users, color: TONE_HEX.emerald },
    { label: 'No-shows', value: flashData.noShows || 0, icon: UserX, color: TONE_HEX.rose },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      {/* Revenue */}
      <Panel>
        <PanelHeader icon={Activity} title="Manager's Flash" subtitle="Live KPIs for the business date" tone="amber" />
        <div className="grid grid-cols-3 gap-px border-t border-white/[0.05] bg-white/[0.03]">
          {[
            { label: 'Room Revenue', value: money(Number(flashData.roomRevenue || 0), cur, true), color: TONE_HEX.indigo },
            { label: 'F&B Revenue', value: money(Number(flashData.fbRevenue || 0), cur, true), color: TONE_HEX.amber },
            { label: 'Net Revenue', value: money(Number(flashData.netRevenue || 0), cur, true), color: TONE_HEX.emerald },
          ].map((col) => (
            <div key={col.label} className="bg-[#0b111e] px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{col.label}</p>
              <p className="mt-0.5 font-mono text-[14px] font-bold tabular-nums" style={{ color: col.color }}>{col.value}</p>
            </div>
          ))}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] text-slate-500">Occupancy (OCC)</span>
            <span className="font-mono text-[12px] font-bold text-emerald-300">{occ}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full transition-all duration-700 bg-indigo-500"
              style={{ width: `${Math.min(100, flashData.occupancyPercentage || 0)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-slate-600">{flashData.occupiedRooms || 0} / {flashData.totalRooms || 0} rooms · ADR {money(adr, cur, true)} · RevPAR {money(revPar, cur, true)}</p>
        </div>
      </Panel>

      {/* Movements */}
      <Panel>
        <PanelHeader title="Operational Movement" tone="indigo" />
        <div className="grid grid-cols-2 gap-px border-t border-white/[0.05] bg-white/[0.03] flex-1">
          {movements.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex flex-col items-center justify-center bg-[#0b111e] py-3 text-center">
                <Icon className="h-4 w-4 mb-1" style={{ color: m.color }} />
                <p className="font-mono text-[20px] font-bold text-white">{m.value}</p>
                <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: `${m.color}90` }}>{m.label}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────────────── */
export default function NightAuditDashboard({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [accountingDepartments, setAccountingDepartments] = useState<Array<{ accountCode?: string; accountName: string; today: number }>>([]);
  const [flashData, setFlashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  const load = useCallback(async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Unable to load audit status');
      setData(json.data);
      setLastRefresh(new Date());

      // Reuse the accountant's authoritative revenue mapping. It includes
      // event invoice journals as well as folio revenue, including before the
      // current night-audit close package has been finalized.
      try {
        const accountingResponse = await fetch(`/api/v1/accountant/revenue?propertyId=${propertyId}`, { cache: 'no-store' });
        const accountingJson = await accountingResponse.json();
        if (accountingResponse.ok) setAccountingDepartments(accountingJson.data?.departments || accountingJson.departments || []);
      } catch { /* Night Audit snapshot remains the fallback. */ }

      const blockers = [
        ...(json.data.system?.openPosSessions || []), ...(json.data.system?.openFrontdeskSessions || []),
        ...(json.data.system?.financialSyncConflicts || []), ...(json.data.financial?.unverifiedComplimentary || []),
        ...(json.data.financial?.pendingCheckInBypasses || []), ...(json.data.cash?.unverifiedTransactions || []),
      ].length;
      const warnings = (json.data.cash?.cashHandovers || []).length + (json.data.operational?.arrivals || []).length;
      window.dispatchEvent(new CustomEvent('night-audit:queue-counts', { detail: {
        '/night-audit': blockers + warnings,
        '/night-audit/ar-ledger': (json.data.financial?.highBalances || []).length,
      }}));

      if (json.data.currentAudit) {
        try {
          const fr = await fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${json.data.businessDate}`, { cache: 'no-store' });
          const fj = await fr.json();
          if (fr.ok) setFlashData(fj.data || fj);
        } catch { /* ignore */ }
      } else {
        setFlashData(null);
      }

      if (json.data.auditState === 'OVERDUE' && !quiet && !managerMode) setWizardOpen(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId, managerMode]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener('night-audit:refresh', refresh);
    return () => window.removeEventListener('night-audit:refresh', refresh);
  }, [load]);

  const execute = async () => {
    setExecuting(true); setError(null);
    try {
      const res = await fetch('/api/v1/night-audit/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Audit execution failed');
      setWizardOpen(false); setSuccessResult(json.data); await load(true);
    } catch (err: any) {
      setError(err.message); setFailureMessage(err.message || 'The Night Audit could not be completed.');
    } finally { setExecuting(false); }
  };

  const handleQueueResolve = (actionType: string, payload: any) => setResolutionAction({ type: actionType as any, item: payload });
  const handleResolutionSuccess = () => { setResolutionAction(null); load(true); };

  // ── Loading / empty states ────────────────────────────────────────────────
  if (propertyLoading) return <Spinner label="Loading workspace…" />;
  if (!propertyId) return (
    <CenteredShell>
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/8">
          <Hotel className="h-7 w-7 text-indigo-300" />
        </span>
        <h2 className="text-xl font-bold text-white">Select a Property</h2>
        <p className="max-w-[280px] text-[13px] text-slate-500">Choose a property from the selector above to open the night audit workspace.</p>
      </div>
    </CenteredShell>
  );
  if (loading || !data) return <Spinner label="Loading audit status…" />;

  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isCompleted = data.auditState === 'COMPLETED';

  return (
    <div className="min-h-full pb-16 pt-4 px-3 sm:px-4 md:px-5" style={{ background: BG }}>
      <div className="mx-auto max-w-[1600px] space-y-4">

        {/* ── Alerts ──────────────────────────────────────────────────────── */}
        {(data.auditState === 'FAILED' || error || message) && (
          <div className="space-y-2">
            {data.auditState === 'FAILED' && (
              <AlertStrip variant="error" icon={AlertTriangle} message="Last audit failed — review the audit log and retry."
                action={<button onClick={() => load(true)} className="shrink-0 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-400/18">Retry</button>}
              />
            )}
            {error && <AlertStrip variant="error" icon={XCircle} message={error} />}
            {message && <AlertStrip variant="success" icon={CheckCircle2} message={message} />}
          </div>
        )}

        {/* ── 1. Status banner (header) ────────────────────────────────────── */}
        <StatusBanner data={data} isAuditInProgress={isAuditInProgress} onOpenWizard={() => setWizardOpen(true)} refreshing={refreshing} managerMode={managerMode} />

        {/* ── 2. KPI strip (OCC / ADR / RevPAR / Revenue / Payments / Variance / In-house) */}
        <KpiStrip data={data} />

        {/* ── 3. Work area (main 8 cols) + Right rail (4 cols) ─────────────── */}
        {!isCompleted ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            {/* Main column */}
            <div className="space-y-4">
              {/* 3a. Attention queue — primary work surface */}
              <div className="min-h-[320px]">
                <AttentionQueue data={data} onResolveItem={managerMode ? undefined : handleQueueResolve} />
              </div>
              {/* 3b. Financial close control */}
              <CloseControl data={data} />
            </div>

            {/* Right rail */}
            <div className="flex flex-col gap-4">
              <AuditReadiness data={data} />
              <OccupancyChart rooms={data.analytics.rooms} />
              {data.financial.guestAmenity && <GuestAmenityControl data={data} />}
            </div>
          </div>
        ) : (
          /* ── Completed state: Flash report + close control ──────────────── */
          <div className="space-y-4">
            {flashData && <ManagersFlash flashData={flashData} data={data} />}
            <CloseControl data={data} />
          </div>
        )}

        {/* ── 4. Analytics row: Revenue trend + Metric cards ──────────────── */}
        <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
          <RevenueTrendChart trend={data.analytics.trend} baseCurrency={data.property.baseCurrency} />
          <MetricCards data={data} accountingDepartments={accountingDepartments} />
        </div>

        {/* ── 5. Activity timeline ────────────────────────────────────────── */}
        <ActivityFeed data={data} />

        {/* ── Freshness footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-3 text-[10.5px] text-slate-600">
          <span>
            {lastRefresh
              ? `Refreshed at ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Awaiting first load'}
            {error && <span className="ml-2 text-rose-400">· refresh failed, data may be stale</span>}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10.5px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCcw className={cx('h-3.5 w-3.5', refreshing ? 'animate-spin' : '')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {!managerMode && (
        <AuditWizard open={wizardOpen} onOpenChange={setWizardOpen} data={data} onExecute={execute} executing={executing} onRefresh={() => load(true)} />
      )}
      {!managerMode && (
        <ResolutionManager action={resolutionAction} onClose={() => setResolutionAction(null)} onSuccess={handleResolutionSuccess} />
      )}
      <AuditSuccessModal open={!!successResult} onOpenChange={(open) => !open && setSuccessResult(null)} result={successResult} businessDate={data.businessDate} />
      <AuditFailureModal open={!!failureMessage} onOpenChange={(open) => !open && setFailureMessage(null)} message={failureMessage || ''} onRetry={execute} />
    </div>
  );
}

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import {
  Loader2, MoonStar, XCircle, AlertTriangle, CheckCircle2,
  RefreshCcw, Hotel, Activity, LogIn, LogOut, Users, UserX,
} from 'lucide-react';

import { NightAuditOverview } from '@/components/night-audit/dashboard/night-audit-overview';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { AuditSuccessModal } from '@/components/night-audit/audit-success-modal';
import { AuditFailureModal } from '@/components/night-audit/audit-failure-modal';
import { cx, money, TONE_HEX } from '@/components/night-audit/dashboard/ui';

/* ── Background gradient ────────────────────────────────────────────────────── */
const BG = 'linear-gradient(160deg, #030712 0%, #05090f 55%, #070a18 100%)';

/* ── Grid texture ───────────────────────────────────────────────────────────── */
const GRID_STYLE: React.CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 32px)',
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 32px)',
  ].join(', '),
};

/* ── Loading shells ─────────────────────────────────────────────────────────── */
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
      <div className="flex flex-col items-center gap-5">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'rgba(129,140,248,0.25)',
            background: 'rgba(129,140,248,0.10)',
            boxShadow: '0 0 32px -8px rgba(129,140,248,0.4)',
          }}
        >
          <MoonStar className="h-6 w-6 text-indigo-300" />
        </span>
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          {label}
        </div>
      </div>
    </CenteredShell>
  );
}

/* ── Alert strip ────────────────────────────────────────────────────────────── */
function AlertStrip({
  variant, icon: Icon, message, action,
}: {
  variant: 'error' | 'success' | 'warning';
  icon: React.ElementType;
  message: string;
  action?: React.ReactNode;
}) {
  const styles = {
    error:   { border: 'rgba(244,63,94,0.2)',   bg: 'rgba(244,63,94,0.06)',   text: '#fb7185' },
    success: { border: 'rgba(52,211,153,0.2)',  bg: 'rgba(52,211,153,0.06)',  text: '#34d399' },
    warning: { border: 'rgba(251,191,36,0.2)',  bg: 'rgba(251,191,36,0.06)',  text: '#fbbf24' },
  }[variant];
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold"
      style={{ borderColor: styles.border, background: styles.bg, color: styles.text }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {action}
    </div>
  );
}

async function readApiJson(response: Response, context: string): Promise<any> {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const contentType = response.headers.get('content-type') || 'unknown content type';
    const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(
      `${context} returned an invalid response (HTTP ${response.status}, ${contentType}).` +
      (preview ? ` ${preview}` : ' Please retry.')
    );
  }
}

/* ── Manager's Flash (shown after audit is closed) ──────────────────────────── */
function ManagersFlash({ flashData, data }: { flashData: any; data: NightAuditData }) {
  const cur = data.property.baseCurrency;
  const occ = flashData.occupancyPercentage?.toFixed(1) || '0.0';
  const adr = Number(flashData.adr || 0);
  const revPar = Number(flashData.revPar || 0);
  const movements = [
    { label: 'Arrivals',    value: flashData.arrivals   || 0, icon: LogIn,   color: TONE_HEX.indigo },
    { label: 'Departures',  value: flashData.departures || 0, icon: LogOut,  color: TONE_HEX.amber },
    { label: 'Walk-ins',    value: flashData.walkIns    || 0, icon: Users,   color: TONE_HEX.emerald },
    { label: 'No-shows',    value: flashData.noShows    || 0, icon: UserX,   color: TONE_HEX.rose },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      {/* Revenue panel */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(7,15,30,0.88)',
          borderColor: 'rgba(245,158,11,0.2)',
          boxShadow: '0 0 60px -20px rgba(245,158,11,0.25)',
        }}
      >
        <div
          className="flex items-center gap-2.5 border-b px-4 py-3"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <Activity className="h-4 w-4 text-amber-400" />
          <div>
            <p className="text-[13px] font-semibold text-white">Manager's Flash</p>
            <p className="text-[11px] text-slate-500">Live KPIs for the business date</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {[
            { label: 'Room Revenue', value: money(Number(flashData.roomRevenue || 0), cur, true), color: TONE_HEX.indigo },
            { label: 'F&B Revenue',  value: money(Number(flashData.fbRevenue   || 0), cur, true), color: TONE_HEX.amber },
            { label: 'Net Revenue',  value: money(Number(flashData.netRevenue  || 0), cur, true), color: TONE_HEX.emerald },
          ].map((col) => (
            <div key={col.label} className="flex flex-col items-center py-3 text-center" style={{ background: 'rgba(7,15,30,0.9)' }}>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600">{col.label}</p>
              <p
                className="mt-1 font-mono text-[16px] font-bold tabular-nums"
                style={{ color: col.color, textShadow: `0 0 20px ${col.color}60` }}
              >
                {col.value}
              </p>
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] text-slate-500">Occupancy (OCC)</span>
            <span className="font-mono text-[13px] font-bold text-emerald-300">{occ}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, flashData.occupancyPercentage || 0)}%`,
                background: TONE_HEX.indigo,
                boxShadow: `0 0 8px ${TONE_HEX.indigo}60`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-600">
            {flashData.occupiedRooms || 0} / {flashData.totalRooms || 0} rooms · ADR {money(adr, cur, true)} · RevPAR {money(revPar, cur, true)}
          </p>
        </div>
      </div>

      {/* Movements panel */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(7,15,30,0.88)',
          borderColor: 'rgba(129,140,248,0.2)',
        }}
      >
        <div
          className="flex items-center gap-2.5 border-b px-4 py-3"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <Users className="h-4 w-4 text-indigo-400" />
          <p className="text-[13px] font-semibold text-white">Operational Movement</p>
        </div>
        <div className="grid grid-cols-2 gap-px flex-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {movements.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="flex flex-col items-center justify-center py-5 text-center"
                style={{ background: 'rgba(7,15,30,0.9)' }}
              >
                <Icon className="h-5 w-5 mb-1.5" style={{ color: m.color }} />
                <p
                  className="font-mono text-[24px] font-bold"
                  style={{ color: 'white', textShadow: `0 0 20px ${m.color}50` }}
                >
                  {m.value}
                </p>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
                  style={{ color: `${m.color}90` }}
                >
                  {m.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────────────── */
export default function NightAuditDashboard({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [backgroundRunning, setBackgroundRunning] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`, { cache: 'no-store' });
      const json = await readApiJson(res, 'Night Audit status service');
      if (!res.ok) throw new Error(json.error?.message || 'Unable to load audit status');
      setData(json.data);
      if (backgroundRunning && !json.data.activeAudit) setBackgroundRunning(false);
      setLastRefresh(new Date());

      const blockers = [
        ...(json.data.system?.openPosSessions || []),
        ...(json.data.system?.openFrontdeskSessions || []),
        ...(json.data.system?.financialSyncConflicts || []),
        ...(json.data.financial?.unverifiedComplimentary || []),
        ...(json.data.financial?.pendingCheckInBypasses || []),
        ...(json.data.cash?.unverifiedTransactions || []),
      ].length;
      const warnings = (json.data.cash?.cashHandovers || []).length + (json.data.operational?.arrivals || []).length;
      window.dispatchEvent(new CustomEvent('night-audit:queue-counts', {
        detail: {
          '/night-audit': blockers + warnings,
          '/night-audit/ar-ledger': (json.data.financial?.highBalances || []).length,
        },
      }));

      if (json.data.auditState === 'OVERDUE' && json.data.canStartAudit && !quiet && !managerMode) {
        setWizardOpen(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId, managerMode, backgroundRunning]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.activeAudit && !backgroundRunning) return;
    const timer = window.setInterval(() => { void load(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [data?.activeAudit, backgroundRunning, load]);
  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener('night-audit:refresh', refresh);
    return () => window.removeEventListener('night-audit:refresh', refresh);
  }, [load]);

  const execute = async () => {
    setExecuting(true); setError(null);
    try {
      const res = await fetch('/api/v1/night-audit/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const json = await readApiJson(res, 'Night Audit execution service');
      if (!res.ok) throw new Error(json.error?.message || 'Audit execution failed');
      setWizardOpen(false);
      if (res.status === 202 || json.data?.accepted) {
        setBackgroundRunning(true);
        setMessage('Night Audit is running in the background. This screen will update automatically until posting is complete.');
      } else {
        setBackgroundRunning(false);
        setSuccessResult(json.data);
      }
      await load(true);
    } catch (err: any) {
      setBackgroundRunning(false);
      setError(err.message); setFailureMessage(err.message || 'The Night Audit could not be completed.');
    } finally { setExecuting(false); }
  };

  // ── Loading / empty states ───────────────────────────────────────────────────
  if (propertyLoading) return <Spinner label="Loading workspace…" />;
  if (!propertyId) return (
    <CenteredShell>
      <div className="flex flex-col items-center gap-5 text-center px-6">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'rgba(129,140,248,0.25)',
            background: 'rgba(129,140,248,0.10)',
            boxShadow: '0 0 40px -12px rgba(129,140,248,0.5)',
          }}
        >
          <Hotel className="h-7 w-7 text-indigo-300" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-white">Select a Property</h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-slate-500">
            Choose a property from the selector above to open the night audit workspace.
          </p>
        </div>
      </div>
    </CenteredShell>
  );
  if (loading || !data) return <Spinner label="Loading audit status…" />;

  return (
    <div
      className="relative min-h-full pb-16 pt-4 px-3 sm:px-4 md:px-5"
      style={{ background: BG }}
    >
      {/* Background grid */}
      <div className="pointer-events-none fixed inset-0 opacity-100" style={GRID_STYLE} />

      <div className="relative mx-auto max-w-[1680px] space-y-4">

        {/* ── Alerts ──────────────────────────────────────────────────────── */}
        {(data.auditState === 'FAILED' || data.auditState === 'COMPLETED_WITH_EXCEPTIONS' || error || message) && (
          <div className="space-y-2">
            {data.auditState === 'FAILED' && (
              <AlertStrip
                variant="error"
                icon={AlertTriangle}
                message="Last audit failed — review the audit log and retry."
                action={
                  <button
                    onClick={() => load(true)}
                    className="shrink-0 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-400/20"
                  >
                    Retry
                  </button>
                }
              />
            )}
            {data.auditState === 'COMPLETED_WITH_EXCEPTIONS' && !error && (
              <AlertStrip variant="warning" icon={AlertTriangle} message="Audit closed with exceptions — review the reconciliation before handover." />
            )}
            {error && <AlertStrip variant="error" icon={XCircle} message={error} />}
            {message && <AlertStrip variant="success" icon={CheckCircle2} message={message} />}
          </div>
        )}

        <NightAuditOverview
          data={data}
          refreshing={refreshing}
          managerMode={managerMode}
          onOpenWizard={() => { if (data.canStartAudit || data.canResumeAudit) setWizardOpen(true); }}
          onRefresh={() => void load(true)}
        />

        {/* ── 2. Work area ─────────────────────────────────────────────────── */}

        {/* ── Freshness footer ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between border-t pt-3 text-[10.5px] text-slate-600"
          style={{ borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <span>
            {lastRefresh
              ? `Refreshed at ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Awaiting first load'}
            {error && <span className="ml-2 text-rose-400">· refresh failed, data may be stale</span>}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10.5px] font-semibold text-slate-400 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-50"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}
          >
            <RefreshCcw className={cx('h-3.5 w-3.5', refreshing ? 'animate-spin' : '')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
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

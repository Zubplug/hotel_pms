'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Panel, PanelHeader, EmptyState, CircularProgress, cx, TONE_HEX } from './ui';

export function AuditReadiness({ data }: { data: NightAuditData }) {
  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isCompleted = data.auditState === 'COMPLETED';
  const isCompletedWithExceptions = data.auditState === 'COMPLETED_WITH_EXCEPTIONS';

  const operationalCount =
    (data.operational.arrivals?.length || 0) +
    (data.operational.departures?.length || 0) +
    (data.operational.roomReconciliation?.filter((r: any) => r.issue).length || 0);
  const systemCount =
    (data.system.openPosSessions?.length || 0) +
    (data.system.openFrontdeskSessions?.length || 0) +
    (data.system.financialSyncConflicts?.length || 0) +
    (data.system.openPosOrders?.length || 0);
  const financialCount =
    (data.financial.highBalances?.length || 0) +
    (data.financial.unverifiedComplimentary?.length || 0) +
    (data.financial.pendingCheckInBypasses?.length || 0) +
    (data.financial.pendingDiscounts?.length || 0) +
    (data.financial.rateVariances?.length || 0) +
    (data.financial.guestAmenity?.blockers?.length || 0) +
    (data.accounting?.transactionExceptions || 0);
  const cashCount =
    (data.cash.cashHandovers?.length || 0) +
    (data.cash.unverifiedTransactions?.length || 0) +
    (data.cash.bankDeposits?.length || 0);

  const sections = [
    {
      key: 'system', title: 'System & Sync', icon: SlidersHorizontal, count: systemCount,
      blocker: systemCount > 0,
    },
    {
      key: 'financial', title: 'Financial', icon: FileCheck2, count: financialCount,
      blocker: (data.financial.pendingCheckInBypasses?.length || 0) > 0 ||
               (data.financial.unverifiedComplimentary?.length || 0) > 0 ||
               (data.accounting?.transactionExceptions || 0) > 0,
    },
    {
      key: 'cash', title: 'Cash', icon: Banknote, count: cashCount,
      blocker: (data.cash.unverifiedTransactions?.length || 0) > 0,
    },
    {
      key: 'operational', title: 'Operations', icon: Building2, count: operationalCount,
      blocker: (data.operational.arrivals?.length || 0) > 0 ||
               (data.operational.departures?.length || 0) > 0,
    },
  ];

  const clearCount = sections.filter((s) => s.count === 0).length;
  const pct = Math.round((clearCount / sections.length) * 100);

  const ringColor =
    isCompleted ? TONE_HEX.emerald :
    isCompletedWithExceptions ? TONE_HEX.amber :
    data.summary.blockers > 0 ? TONE_HEX.rose :
    clearCount === sections.length ? TONE_HEX.emerald :
    TONE_HEX.amber;

  const overallTone =
    isCompletedWithExceptions ? 'amber' :
    data.summary.blockers > 0 ? 'rose' :
    clearCount === sections.length ? 'emerald' : 'amber';

  const statusLabel =
    isCompleted ? '✓ Closed' :
    isCompletedWithExceptions ? 'Closed w/ exceptions' :
    data.summary.blockers > 0 ? `${data.summary.blockers} blockers` :
    clearCount === sections.length ? '✓ Ready' : 'Review needed';

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={ShieldCheck}
        title="Audit Readiness"
        subtitle={`${clearCount} of ${sections.length} areas clear`}
        tone={overallTone as any}
        actions={
          <span
            className="text-[11px] font-semibold"
            style={{ color: ringColor }}
          >
            {statusLabel}
          </span>
        }
      />

      {/* Circular progress */}
      <div className="flex items-center justify-center py-5 relative">
        {/* Ambient glow behind ring */}
        <div
          className="absolute w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${ringColor}18 0%, transparent 70%)`,
          }}
        />
        <CircularProgress
          value={clearCount}
          max={sections.length}
          size={132}
          strokeWidth={11}
          color={ringColor}
          label={`${pct}%`}
          sublabel="READINESS"
        />
      </div>

      {/* Section list */}
      <ul className="divide-y flex-1" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {sections.map((s) => {
          const Icon = s.icon;
          const clear = s.count === 0;
          const color = clear ? TONE_HEX.emerald : s.blocker ? TONE_HEX.rose : TONE_HEX.amber;
          const StatusIcon = clear ? CheckCircle2 : s.blocker ? XCircle : AlertTriangle;

          return (
            <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  borderColor: `${color}25`,
                  background: `${color}0d`,
                  color,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white">{s.title}</p>
                {/* Mini progress bar */}
                <div className="mt-0.5 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: clear ? '100%' : '15%',
                      background: color,
                      boxShadow: clear ? `0 0 6px ${color}60` : undefined,
                    }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <StatusIcon
                  className="h-3.5 w-3.5"
                  style={{
                    color,
                    filter: clear ? `drop-shadow(0 0 4px ${color}70)` : undefined,
                  }}
                />
                <span
                  className="font-mono text-[11px] font-semibold tabular-nums"
                  style={{ color }}
                >
                  {clear ? 'Clear' : `${s.count}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer banner */}
      {clearCount === sections.length && !isCompletedWithExceptions && (
        <div
          className="flex items-center gap-2 border-t px-4 py-2.5 text-[11.5px] font-semibold text-emerald-300"
          style={{
            borderColor: 'rgba(52,211,153,0.15)',
            background: 'rgba(52,211,153,0.06)',
          }}
        >
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0"
            style={{ filter: `drop-shadow(0 0 4px ${TONE_HEX.emerald}80)` }}
          />
          All pre-close checks passed. Ready to run audit.
        </div>
      )}
      {data.summary.blockers > 0 && (
        <div
          className="flex items-center gap-2 border-t px-4 py-2.5 text-[11.5px] font-semibold text-rose-300"
          style={{
            borderColor: 'rgba(244,63,94,0.15)',
            background: 'rgba(244,63,94,0.06)',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {data.summary.blockers} blocker{data.summary.blockers > 1 ? 's' : ''} must be resolved before audit close.
        </div>
      )}
    </Panel>
  );
}

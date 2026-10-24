'use client';
import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Panel, PanelHeader, EmptyState, cx, TONE_HEX } from './ui';

export function AuditReadiness({ data }: { data: NightAuditData }) {
  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isCompleted = data.auditState === 'COMPLETED';

  const operationalCount = (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((r: any) => r.issue).length || 0);
  const systemCount = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0) + (data.system.openPosOrders?.length || 0);
  const financialCount = (data.financial.highBalances?.length || 0) + (data.financial.unverifiedComplimentary?.length || 0) + (data.financial.pendingCheckInBypasses?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0) + (data.financial.guestAmenity?.blockers?.length || 0) + (data.accounting?.transactionExceptions || 0);
  const cashCount = (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0) + (data.cash.bankDeposits?.length || 0);

  const sections = [
    {
      key: 'system', title: 'System & Sync', icon: SlidersHorizontal, count: systemCount,
      blocker: systemCount > 0,
    },
    {
      key: 'financial', title: 'Financial', icon: FileCheck2, count: financialCount,
      blocker: (data.financial.pendingCheckInBypasses?.length || 0) > 0 || (data.financial.unverifiedComplimentary?.length || 0) > 0 || (data.accounting?.transactionExceptions || 0) > 0,
    },
    {
      key: 'cash', title: 'Cash', icon: Banknote, count: cashCount,
      blocker: (data.cash.unverifiedTransactions?.length || 0) > 0,
    },
    {
      key: 'operational', title: 'Operations', icon: Building2, count: operationalCount,
      blocker: false,
    },
  ];

  const clearCount = sections.filter((s) => s.count === 0).length;
  const readyTone = isCompleted ? 'text-emerald-300' : data.summary.blockers > 0 ? 'text-rose-300' : clearCount === sections.length ? 'text-emerald-300' : 'text-amber-300';

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={ShieldCheck}
        title="Audit Readiness"
        subtitle={`${clearCount} of ${sections.length} areas clear`}
        tone={data.summary.blockers > 0 ? 'rose' : 'emerald'}
        actions={
          <span className={cx('text-[11px] font-semibold', readyTone)}>
            {isCompleted ? '✓ Closed' : data.summary.blockers > 0 ? `${data.summary.blockers} blockers` : clearCount === sections.length ? '✓ Ready' : 'Review needed'}
          </span>
        }
      />

      {/* Progress bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Pre-close score</span>
          <span className="font-mono text-[11px] font-semibold text-slate-300">{clearCount}/{sections.length}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(clearCount / sections.length) * 100}%`,
              background: clearCount === sections.length ? TONE_HEX.emerald : TONE_HEX.amber,
            }}
          />
        </div>
      </div>

      <ul className="divide-y divide-white/[0.04] flex-1">
        {sections.map((s) => {
          const Icon = s.icon;
          const clear = s.count === 0;
          const color = clear ? TONE_HEX.emerald : s.blocker ? TONE_HEX.rose : TONE_HEX.amber;
          const StatusIcon = clear ? CheckCircle2 : s.blocker ? XCircle : AlertTriangle;
          return (
            <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: `${color}25`, background: `${color}0d`, color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white">{s.title}</p>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: clear ? '100%' : '18%', background: color }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusIcon className="h-3.5 w-3.5" style={{ color }} />
                <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
                  {clear ? 'Clear' : `${s.count}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

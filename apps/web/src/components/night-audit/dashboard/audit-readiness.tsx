import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

export function AuditReadiness({ data }: { data: NightAuditData }) {
  const { blockers } = data.summary;
  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isReady = blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';

  const operationalCount = (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((r) => r.issue).length || 0);
  const systemCount = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0);
  const financialCount = (data.financial.highBalances?.length || 0) + (data.financial.unverifiedComplimentary?.length || 0) + (data.financial.pendingCheckInBypasses?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0);
  const cashCount = (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0) + (data.cash.bankDeposits?.length || 0);

  const sections = [
    {
      title: 'Operational Controls',
      description: 'Arrivals, departures and room status gaps.',
      icon: Building2,
      count: operationalCount,
      hasBlocker: false,
      color: '#f59e0b',
    },
    {
      title: 'System & Sync',
      description: 'Open shifts, POS tasks and sync conflicts.',
      icon: SlidersHorizontal,
      count: systemCount,
      hasBlocker: systemCount > 0,
      color: systemCount > 0 ? '#f43f5e' : '#10b981',
    },
    {
      title: 'Financial Review',
      description: 'Check-in bypasses, complimentary and variances.',
      icon: FileCheck2,
      count: financialCount,
      hasBlocker: (data.financial.pendingCheckInBypasses?.length || 0) > 0 || (data.financial.unverifiedComplimentary?.length || 0) > 0,
      color: '#f59e0b',
    },
    {
      title: 'Cash Reconciliation',
      description: 'Unverified transactions, deposits and handovers.',
      icon: Banknote,
      count: cashCount,
      hasBlocker: (data.cash.cashHandovers?.length || 0) > 0 || (data.cash.unverifiedTransactions?.length || 0) > 0,
      color: cashCount > 0 ? '#f43f5e' : '#10b981',
    },
  ];

  const readinessBadge = isReady
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : data.auditState === 'COMPLETED'
      ? 'border-slate-600/40 bg-slate-600/15 text-slate-400'
      : 'border-rose-400/30 bg-rose-400/10 text-rose-300';

  const readinessLabel = isReady
    ? 'Ready to run'
    : data.auditState === 'COMPLETED'
      ? 'Closed'
      : `${blockers} blockers`;

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] p-6 backdrop-blur-md sm:p-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-400">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Audit Readiness</h3>
            <p className="text-[11px] text-slate-500">System health and pre-requisites</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${readinessBadge}`}>
          {readinessLabel}
        </span>
      </div>

      {/* Section rows */}
      <div className="mt-5 flex-1 space-y-2.5">
        {sections.map((section) => {
          const Icon = section.icon;
          const isClear = section.count === 0;
          const barColor = isClear ? '#10b981' : section.hasBlocker ? '#f43f5e' : '#f59e0b';
          const barWidth = isClear ? '100%' : section.hasBlocker ? '70%' : '45%';

          const iconStyle = isClear
            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
            : section.hasBlocker
              ? 'border-rose-400/20 bg-rose-400/10 text-rose-400'
              : 'border-amber-400/20 bg-amber-400/10 text-amber-400';

          return (
            <div
              key={section.title}
              className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 transition-all duration-150 hover:border-white/[0.08] hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconStyle}`}>
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{section.title}</p>
                    <div className="shrink-0">
                      {isClear ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Clear
                        </span>
                      ) : section.hasBlocker ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                          <XCircle className="h-3.5 w-3.5" />
                          {section.count} issue{section.count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {section.count} review{section.count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-0.5 text-[11px] text-slate-500">{section.description}</p>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: barWidth, background: barColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

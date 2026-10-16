import React, { useState } from 'react';
import { NightAuditData } from '@/types/night-audit';
import {
  Building2, SlidersHorizontal, FileCheck2, Banknote,
  CheckCircle2, AlertTriangle, XCircle, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react';

function ReadinessRing({ readyCount, total }: { readyCount: number; total: number }) {
  const size = 80;
  const sw = 7;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? readyCount / total : 0;
  const dash = circumference * pct;
  const color = pct === 1 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}70)`, transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white leading-none">{readyCount}/{total}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">Clear</span>
      </div>
    </div>
  );
}

export function AuditReadiness({ data }: { data: NightAuditData }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { blockers } = data.summary;
  const isAuditInProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isReady = blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';

  const operationalCount = (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((r) => r.issue).length || 0);
  const systemCount = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0) + (data.system.openPosOrders?.length || 0);
  const financialCount = (data.financial.highBalances?.length || 0) + (data.financial.unverifiedComplimentary?.length || 0) + (data.financial.pendingCheckInBypasses?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0) + (data.financial.guestAmenity?.blockers?.length || 0) + (data.financial.guestAmenity?.zeroCostItems?.length || 0) + (data.accounting?.transactionExceptions || 0);
  const cashCount = (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0) + (data.cash.bankDeposits?.length || 0);

  const sections = [
    {
      key: 'operational',
      title: 'Operational Controls',
      description: 'Arrivals, departures and room status gaps.',
      icon: Building2,
      count: operationalCount,
      hasBlocker: false,
    },
    {
      key: 'system',
      title: 'System & Sync',
      description: 'Open shifts, POS tasks and sync conflicts.',
      icon: SlidersHorizontal,
      count: systemCount,
      hasBlocker: systemCount > 0,
    },
    {
      key: 'financial',
      title: 'Financial Review',
      description: 'Posting, folio, amenity, bypass and variance controls.',
      icon: FileCheck2,
      count: financialCount,
      hasBlocker:
        (data.financial.pendingCheckInBypasses?.length || 0) > 0 ||
        (data.financial.unverifiedComplimentary?.length || 0) > 0 ||
        (data.financial.guestAmenity?.blockers?.length || 0) > 0 ||
        (data.accounting?.transactionExceptions || 0) > 0,
    },
    {
      key: 'cash',
      title: 'Cash Reconciliation',
      description: 'Unverified transactions, deposits and handovers.',
      icon: Banknote,
      count: cashCount,
      hasBlocker: (data.cash.unverifiedTransactions?.length || 0) > 0,
    },
  ];

  const readySections = sections.filter((s) => s.count === 0).length;
  const readinessLabel = isReady
    ? 'Ready to run'
    : data.auditState === 'COMPLETED'
    ? 'Closed'
    : `${blockers} blockers`;

  const readinessBadge = isReady
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : data.auditState === 'COMPLETED'
    ? 'border-slate-600/40 bg-slate-600/15 text-slate-400'
    : 'border-rose-400/30 bg-rose-400/10 text-rose-300';

  return (
    <div
      className="flex h-full flex-col rounded-[24px] border border-white/[0.06] overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.02)',
        boxShadow: isReady ? '0 0 0 1px rgba(16,185,129,0.15), inset 0 1px 0 rgba(16,185,129,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
        <div className="flex items-center gap-3">
          <ReadinessRing readyCount={readySections} total={sections.length} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Audit Readiness</h3>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${readinessBadge}`}>
                {readinessLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">System health and pre-requisites</p>
          </div>
        </div>
        {isReady && (
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Section rows */}
      <div className="flex-1 divide-y divide-white/[0.04] overflow-y-auto">
        {sections.map((section) => {
          const Icon = section.icon;
          const isClear = section.count === 0;
          const isExpanded = expandedSection === section.key;

          const iconTone = isClear
            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
            : section.hasBlocker
            ? 'border-rose-400/20 bg-rose-400/10 text-rose-400'
            : 'border-amber-400/20 bg-amber-400/10 text-amber-400';

          const barColor = isClear ? '#10b981' : section.hasBlocker ? '#f43f5e' : '#f59e0b';

          return (
            <div key={section.key}>
              <button
                className="group w-full px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                onClick={() => setExpandedSection(isExpanded ? null : section.key)}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconTone}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{section.title}</p>
                      <div className="flex items-center gap-2">
                        <div className="shrink-0">
                          {isClear ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Clear
                            </span>
                          ) : section.hasBlocker ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                              <XCircle className="h-3.5 w-3.5" />
                              {section.count} issue{section.count > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {section.count} review{section.count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                      </div>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: isClear ? '100%' : '20%',
                          background: barColor,
                          boxShadow: isClear ? `0 0 6px ${barColor}60` : 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/[0.04] bg-white/[0.01] px-5 py-3">
                  <p className="text-[11px] leading-relaxed text-slate-400">{section.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">
                      {isClear ? 'No records require review' : 'Server-returned evidence'}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                      {section.count} record{section.count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

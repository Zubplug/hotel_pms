import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

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
      tone: 'amber',
    },
    {
      title: 'System & Sync',
      description: 'Open shifts, POS tasks and sync conflicts.',
      icon: SlidersHorizontal,
      count: systemCount,
      hasBlocker: systemCount > 0,
      tone: 'rose',
    },
    {
      title: 'Financial Review',
      description: 'Check-in bypasses, complimentary records and variances.',
      icon: FileCheck2,
      count: financialCount,
      hasBlocker: (data.financial.pendingCheckInBypasses?.length || 0) > 0 || (data.financial.unverifiedComplimentary?.length || 0) > 0,
      tone: 'amber',
    },
    {
      title: 'Cash Reconciliation',
      description: 'Unverified transactions, bank deposits and handovers.',
      icon: Banknote,
      count: cashCount,
      hasBlocker: (data.cash.cashHandovers?.length || 0) > 0 || (data.cash.unverifiedTransactions?.length || 0) > 0,
      tone: 'rose',
    },
  ];

  const badgeClass = isReady
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : data.auditState === 'COMPLETED'
      ? 'bg-slate-100 text-slate-700 border border-slate-200'
      : 'bg-rose-100 text-rose-700 border border-rose-200';

  return (
    <Card className="h-full border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-xl font-semibold text-slate-900">Audit Readiness</CardTitle>
          <p className="mt-1 text-sm text-slate-500">System health checks and pre-requisites.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
          {isReady ? 'Ready to run' : data.auditState === 'COMPLETED' ? 'Closed' : `${blockers} blockers`}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isClear = section.count === 0;

          return (
            <div
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isClear
                      ? 'bg-slate-200 text-slate-600'
                      : section.hasBlocker
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{section.title}</p>
                    <div className="shrink-0">
                      {isClear ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Clear
                        </span>
                      ) : section.hasBlocker ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-700">
                          <XCircle className="h-4 w-4" />
                          {section.count} issue{section.count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          {section.count} review{section.count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        isClear ? 'w-full bg-emerald-500' : section.hasBlocker ? 'w-3/4 bg-rose-500' : 'w-1/2 bg-amber-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

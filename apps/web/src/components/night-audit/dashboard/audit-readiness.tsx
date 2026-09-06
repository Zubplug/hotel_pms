import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, SlidersHorizontal, FileCheck2, Banknote, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export function AuditReadiness({ data }: { data: NightAuditData }) {
  const { blockers, warnings } = data.summary;
  const isAuditInProgress = (data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING');
  const isReady = blockers === 0 && !isAuditInProgress && data.auditState !== 'COMPLETED';

  const operationalCount = (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter(r => r.issue).length || 0);
  
  const systemCount = (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0);
  
  const financialCount = (data.financial.highBalances?.length || 0) + (data.financial.unverifiedComplimentary?.length || 0) + (data.financial.pendingCheckInBypasses?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0);
  
  const cashCount = (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0) + (data.cash.bankDeposits?.length || 0);

  const sections = [
    { 
      title: 'Operational Controls', 
      description: 'Arrivals, departures and room status discrepancies.',
      icon: Building2, 
      count: operationalCount,
      hasBlocker: false // Arrivals/departures are warnings in current logic
    },
    { 
      title: 'System & Sync', 
      description: 'Open shifts, POS sessions, and PMS sync conflicts.',
      icon: SlidersHorizontal, 
      count: systemCount,
      hasBlocker: systemCount > 0 // Open sessions/sync conflicts are blockers
    },
    { 
      title: 'Financial Review', 
      description: 'Check-in bypasses, complimentary transactions, and variances.',
      icon: FileCheck2, 
      count: financialCount,
      hasBlocker: (data.financial.pendingCheckInBypasses?.length || 0) > 0 || (data.financial.unverifiedComplimentary?.length || 0) > 0
    },
    { 
      title: 'Cash Reconciliation', 
      description: 'Unverified transactions, bank deposits, and handovers.',
      icon: Banknote, 
      count: cashCount,
      hasBlocker: (data.cash.cashHandovers?.length || 0) > 0 || (data.cash.unverifiedTransactions?.length || 0) > 0
    },
  ];

  return (
    <Card className="h-full border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-xl font-semibold">Audit Readiness</CardTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            System health checks and pre-requisites.
          </p>
        </div>
        <Badge 
          variant={isReady ? 'default' : data.auditState === 'COMPLETED' ? 'outline' : 'destructive'}
          className={
            isReady 
              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300' 
              : data.auditState === 'COMPLETED'
              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
              : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300'
          }
        >
          {isReady ? 'Ready to run' : data.auditState === 'COMPLETED' ? 'Closed' : `${blockers} Blockers`}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            const isClear = section.count === 0;
            
            return (
              <div 
                key={section.title} 
                className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
              >
                <div className={`rounded-xl p-3 shrink-0 transition-colors ${
                  isClear 
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    : section.hasBlocker
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{section.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{section.description}</p>
                </div>
                
                <div className="shrink-0 flex items-center justify-end">
                  {isClear ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Clear</span>
                    </div>
                  ) : section.hasBlocker ? (
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-sm font-medium">
                      <XCircle className="h-4 w-4" />
                      <span>{section.count} Issue{section.count > 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{section.count} Review{section.count > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

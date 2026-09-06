import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2 } from 'lucide-react';

interface SystemControlReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

export function SystemControlReview({ data, onResolve }: SystemControlReviewProps) {
  const { openPosSessions, openFrontdeskSessions, financialSyncConflicts } = data.system;
  const hasIssues = (openPosSessions?.length || 0) > 0 || (openFrontdeskSessions?.length || 0) > 0 || (financialSyncConflicts?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5" /> 
        <span>All systems and integrations are healthy.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {openPosSessions?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Open POS Sessions (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">All Point of Sale sessions must be closed and reconciled before the business day can end.</p>
          </div>
          <div className="space-y-2">
            {openPosSessions.map((pos: any) => (
              <div key={pos.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">{pos.outlet?.name || 'Register'}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Opened by {pos.openedBy}</p>
                </div>
                <button 
                  onClick={() => onResolve('POS_SESSION', pos)} 
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {openFrontdeskSessions?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Open Front Desk Shifts (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">All Front Desk cashier shifts must be closed to prevent cross-day posting conflicts.</p>
          </div>
          <div className="space-y-2">
            {openFrontdeskSessions.map((fd: any) => (
              <div key={fd.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">Shift Reference: {fd.shiftReference}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Status: {fd.status}</p>
                </div>
                <button 
                  onClick={() => onResolve('FRONTDESK_SHIFT', fd)} 
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {financialSyncConflicts?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Financial Sync Conflicts (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">Payments or charges failed to sync with the accounting system.</p>
          </div>
          <div className="space-y-2">
            {financialSyncConflicts.map((sc: any) => (
              <div key={sc.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">Type: {sc.aggregateType}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Event: {sc.hotelEvent?.eventType || 'Unknown'}</p>
                </div>
                <button 
                  onClick={() => onResolve('SYNC_CONFLICT', sc)} 
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

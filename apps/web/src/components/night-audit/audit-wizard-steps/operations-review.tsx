import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2 } from 'lucide-react';

interface OperationsReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

export function OperationsReview({ data, onResolve }: OperationsReviewProps) {
  const { arrivals, departures, roomReconciliation } = data.operational;
  const hasIssues = (arrivals?.length || 0) > 0 || (departures?.length || 0) > 0 || (roomReconciliation?.filter(r => r.issue).length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5" /> 
        <span>All arrivals, departures, and rooms are processed.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {arrivals?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Pending Arrivals</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Guests scheduled to arrive today must be checked in, cancelled, or marked as no-show.</p>
          </div>
          <div className="space-y-2">
            {arrivals.map((arr: any) => (
              <div key={arr.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{arr.primaryGuest?.firstName} {arr.primaryGuest?.lastName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirmation: {arr.confirmationNumber}</p>
                </div>
                <button 
                  onClick={() => onResolve('ARRIVALS', arr)} 
                  className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {departures?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Pending Departures</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Guests scheduled to depart today must be checked out or have their stay extended.</p>
          </div>
          <div className="space-y-2">
            {departures.map((dep: any) => (
              <div key={dep.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{dep.primaryGuest?.firstName} {dep.primaryGuest?.lastName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirmation: {dep.confirmationNumber}</p>
                </div>
                <button 
                  onClick={() => onResolve('DEPARTURES', dep)} 
                  className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {roomReconciliation?.filter((r: any) => r.issue).length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-500">Room Discrepancies</h4>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Rooms where the Housekeeping status doesn't match the expected Front Desk status.</p>
          </div>
          <div className="space-y-2">
            {roomReconciliation.filter((r: any) => r.issue).map((rm: any) => (
              <div key={rm.roomId} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-amber-300 dark:hover:border-amber-500/50">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-400">Room {rm.roomNumber}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">PMS: {rm.pmsStatus} (Expected: {rm.expected}) | HK: {rm.hkStatus}</p>
                </div>
                <button 
                  onClick={() => onResolve('ROOM_DISCREPANCY', rm)} 
                  className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Fix
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

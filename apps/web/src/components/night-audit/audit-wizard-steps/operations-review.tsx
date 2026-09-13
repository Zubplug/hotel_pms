import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2 } from 'lucide-react';

interface OperationsReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

const GLASS = { background: 'rgba(255,255,255,0.025)' };

export function OperationsReview({ data, onResolve }: OperationsReviewProps) {
  const { arrivals, departures, roomReconciliation } = data.operational;
  const hasIssues = (arrivals?.length || 0) > 0 || (departures?.length || 0) > 0 || (roomReconciliation?.filter(r => r.issue).length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">All arrivals, departures, and rooms are processed.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {arrivals?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="text-sm font-bold text-sky-300">Pending Arrivals</h4>
            <p className="mt-0.5 text-xs text-sky-400/70">Guests scheduled to arrive today must be checked in, cancelled, or marked as no-show.</p>
          </div>
          <div className="space-y-2">
            {arrivals.map((arr: any) => (
              <div key={arr.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.06] p-4 text-sm transition-all hover:border-white/[0.1] sm:flex-row sm:items-center" style={GLASS}>
                <div>
                  <p className="font-bold text-slate-200">{arr.primaryGuest?.firstName} {arr.primaryGuest?.lastName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Confirmation: <span className="font-medium text-slate-400">{arr.confirmationNumber}</span></p>
                </div>
                <button 
                  onClick={() => onResolve('ARRIVALS', arr)} 
                  className="w-full shrink-0 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-bold text-sky-300 transition-all hover:bg-sky-400/20 sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {departures?.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-sky-300">Pending Departures</h4>
            <p className="mt-0.5 text-xs text-sky-400/70">Guests scheduled to depart today must be checked out or have their stay extended.</p>
          </div>
          <div className="space-y-2">
            {departures.map((dep: any) => (
              <div key={dep.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.06] p-4 text-sm transition-all hover:border-white/[0.1] sm:flex-row sm:items-center" style={GLASS}>
                <div>
                  <p className="font-bold text-slate-200">{dep.primaryGuest?.firstName} {dep.primaryGuest?.lastName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Confirmation: <span className="font-medium text-slate-400">{dep.confirmationNumber}</span></p>
                </div>
                <button 
                  onClick={() => onResolve('DEPARTURES', dep)} 
                  className="w-full shrink-0 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-bold text-sky-300 transition-all hover:bg-sky-400/20 sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {roomReconciliation?.filter((r: any) => r.issue).length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">Room Discrepancies</h4>
            <p className="mt-0.5 text-xs text-amber-400/70">Rooms where the Housekeeping status doesn't match the expected Front Desk status.</p>
          </div>
          <div className="space-y-2">
            {roomReconciliation.filter((r: any) => r.issue).map((rm: any) => (
              <div key={rm.roomId} className="flex flex-col justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.03] p-4 text-sm transition-all hover:bg-amber-400/[0.05] sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-amber-200">Room {rm.roomNumber}</p>
                  <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-amber-300/80">
                    <span className="rounded border border-amber-400/20 px-1.5 py-0.5">PMS: {rm.pmsStatus}</span>
                    <span>Expected: {rm.expected}</span>
                    <span className="rounded border border-amber-400/20 px-1.5 py-0.5">HK: {rm.hkStatus}</span>
                  </p>
                </div>
                <button 
                  onClick={() => onResolve('ROOM_DISCREPANCY', rm)} 
                  className="w-full shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20 sm:w-auto text-center"
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

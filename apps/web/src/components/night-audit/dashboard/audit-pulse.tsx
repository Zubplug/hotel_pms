import React from 'react';
import { Activity, AlertTriangle, BedDouble, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NightAuditData } from '@/types/night-audit';

export function AuditPulse({ data }: { data: NightAuditData }) {
  const blockers = data.summary.blockers || 0;
  const warnings = data.summary.warnings || 0;
  const totalOpen = blockers + warnings;
  const rooms = data.analytics.rooms;
  const occupancy = rooms?.total ? Math.round((rooms.occupied / rooms.total) * 100) : 0;
  const activityCount = data.activityFeed?.length || 0;
  const controls = [
    { label: 'System', value: (data.system.openPosSessions?.length || 0) + (data.system.openFrontdeskSessions?.length || 0) + (data.system.financialSyncConflicts?.length || 0), tone: 'bg-violet-500' },
    { label: 'Financial', value: (data.financial.highBalances?.length || 0) + (data.financial.pendingDiscounts?.length || 0) + (data.financial.rateVariances?.length || 0), tone: 'bg-amber-500' },
    { label: 'Cash', value: (data.cash.cashHandovers?.length || 0) + (data.cash.unverifiedTransactions?.length || 0), tone: 'bg-rose-500' },
    { label: 'Operations', value: (data.operational.arrivals?.length || 0) + (data.operational.departures?.length || 0) + (data.operational.roomReconciliation?.filter((room) => room.issue).length || 0), tone: 'bg-sky-500' },
  ];
  const maxControlValue = Math.max(...controls.map((control) => control.value), 1);

  return (
    <Card className="overflow-hidden rounded-[24px] border-slate-200/70 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
      <CardContent className="p-0">
        <div className="grid divide-y divide-slate-100 md:grid-cols-[1.15fr_1fr_1fr] md:divide-x md:divide-y-0">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 to-indigo-950 p-5 text-white sm:p-6">
            <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/70">Operational pulse</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">Control room summary</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">LIVE</span>
            </div>
            <div className="relative mt-7 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight">{totalOpen}</span>
              <span className="mb-1.5 text-xs text-slate-400">open items<br />across all controls</span>
            </div>
            <div className="relative mt-5 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-rose-200"><AlertTriangle className="h-3.5 w-3.5" /> {blockers} blockers</span>
              <span className="flex items-center gap-1.5 text-amber-200"><Activity className="h-3.5 w-3.5" /> {warnings} to review</span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-4 w-4" /></span><p className="text-sm font-semibold text-slate-900">Control distribution</p></div>
              <span className="text-[11px] font-medium text-slate-400">{activityCount} events</span>
            </div>
            <div className="mt-5 space-y-3">
              {controls.map((control) => <div key={control.label} className="flex items-center gap-3 text-xs"><span className="w-[70px] text-slate-500">{control.label}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${control.tone}`} style={{ width: `${Math.max(control.value ? 12 : 4, (control.value / maxControlValue) * 100)}%` }} /></div><span className="w-4 text-right font-semibold text-slate-700">{control.value}</span></div>)}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BedDouble className="h-4 w-4" /></span><p className="text-sm font-semibold text-slate-900">Demand signal</p></div>
            <div className="mt-5 flex items-end justify-between"><div><span className="text-3xl font-semibold tracking-tight text-slate-900">{occupancy}%</span><p className="mt-1 text-xs text-slate-500">current occupancy</p></div><span className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {rooms?.occupied || 0}/{rooms?.total || 0} rooms</span></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${occupancy}%` }} /></div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Use occupancy alongside ADR and RevPAR below to identify revenue pressure before closing.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

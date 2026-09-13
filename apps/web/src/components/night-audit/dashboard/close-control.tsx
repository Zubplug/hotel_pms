import React from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, CircleDollarSign, FileWarning, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NightAuditData } from '@/types/night-audit';

const statusMeta: Record<string, { label: string; className: string }> = {
  READY: { label: 'Ready to start', className: 'bg-indigo-50 text-indigo-700' },
  BLOCKED: { label: 'Blocked', className: 'bg-rose-50 text-rose-700' },
  CANNOT_CLOSE: { label: 'Cannot close', className: 'bg-rose-50 text-rose-700' },
  HAS_VARIANCE: { label: 'Has variance', className: 'bg-amber-50 text-amber-700' },
  HAS_UNRESOLVED_EXCEPTIONS: { label: 'Unresolved exceptions', className: 'bg-amber-50 text-amber-700' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-sky-50 text-sky-700' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700' },
  COMPLETED_WITH_EXCEPTIONS: { label: 'Completed with exceptions', className: 'bg-amber-50 text-amber-700' },
  FAILED: { label: 'Failed', className: 'bg-rose-50 text-rose-700' },
};

export function CloseControl({ data }: { data: NightAuditData }) {
  const close = data.closeControl;
  const status = statusMeta[close?.status || 'READY'] || statusMeta.READY;
  const journal = data.accounting?.journal;
  const insights = data.insights || [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="border border-slate-200/70 bg-white/85 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900"><LockKeyhole className="h-5 w-5 text-indigo-600" />Financial close control</CardTitle>
            <p className="mt-1 text-sm text-slate-500">A controller view of the current business-date close.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ControlMetric icon={BookOpenCheck} label="GL control" value={journal?.status || 'NOT RUN'} detail={`${journal?.postedEntryCount || 0} posted entries`} tone={journal?.status === 'BALANCED' ? 'emerald' : 'amber'} />
            <ControlMetric icon={FileWarning} label="Open exceptions" value={String(data.accounting?.transactionExceptions || 0)} detail="Payment exceptions" tone={data.accounting?.transactionExceptions ? 'rose' : 'emerald'} />
            <ControlMetric icon={BookOpenCheck} label="Accounting period" value={data.accounting?.period?.status || 'NOT SET'} detail={data.accounting?.period?.name || 'No active period'} tone={data.accounting?.period?.status === 'OPEN' ? 'emerald' : 'amber'} />
            <ControlMetric icon={CircleDollarSign} label="Balance proof" value={close?.hasOpeningClosingBalance ? 'Available' : 'Pending'} detail={close?.hasOpeningClosingBalance ? 'Date-scoped ledger' : 'Ledger enhancement required'} tone={close?.hasOpeningClosingBalance ? 'emerald' : 'amber'} />
          </div>
          <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3 text-xs ${close?.hasOpeningClosingBalance ? 'border-emerald-100 bg-emerald-50/70 text-emerald-800' : 'border-amber-100 bg-amber-50/70 text-amber-800'}`}>
            {close?.hasOpeningClosingBalance ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <p>{close?.hasOpeningClosingBalance ? 'Opening, activity, and closing balances agree for all available dated ledgers.' : 'Balance proof is incomplete or contains a variance. Unavailable ledgers remain explicitly identified in the close package.'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/70 bg-white/85 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-3"><CardTitle className="text-xl text-slate-900">Smart audit signals</CardTitle><p className="mt-1 text-sm text-slate-500">Deterministic insights from live LodgeCore controls.</p></CardHeader>
        <CardContent className="space-y-3">
          {insights.length ? insights.map((insight) => (
            <div key={`${insight.title}-${insight.metric}`} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              {insight.severity === 'HIGH' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
              <div><p className="text-sm font-semibold text-slate-800">{insight.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{insight.detail}</p></div>
            </div>
          )) : <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />No abnormal close signals detected.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function ControlMetric({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string; detail: string; tone: 'emerald' | 'amber' | 'rose' }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700' };
  return <div className={`rounded-xl p-3 ${colors[tone]}`}><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-70">{label}</span><Icon className="h-4 w-4" /></div><p className="mt-2 text-lg font-semibold">{value}</p><p className="mt-1 text-xs opacity-70">{detail}</p></div>;
}

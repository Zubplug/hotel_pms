'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { toast } from 'sonner';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { NightAuditData } from '@/types/night-audit';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileCheck, FileWarning,
  Loader2, RefreshCw, ShieldAlert, Wallet,
} from 'lucide-react';

type TrialBalance = {
  auditStatus: string;
  totals: { debit: number; credit: number; difference: number; status: string };
  accounts: Array<{ accountCode: string; accountName: string; department: string; debit: number; credit: number; netBalance: number; transactionCount: number }>;
};

type Receivable = {
  folioNumber: string;
  guest?: { name?: string } | null;
  reservation?: { room?: string | null; status?: string } | null;
  financials: { balance: number; currency: string };
  aging: { status: string; daysOutstanding: number };
};

async function readApi<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message || body.error || 'Request failed');
  }
  return body.data ?? body;
}

const money = (value: unknown, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));

export default function AccountantAuditPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId;
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const statusQuery = useQuery<NightAuditData>({
    queryKey: ['accountant-audit-status', propertyId],
    queryFn: () => readApi(`/api/v1/night-audit/status?propertyId=${propertyId}`),
    enabled: Boolean(propertyId),
    refetchInterval: 30000,
  });

  const businessDate = statusQuery.data?.businessDate;
  const trialQuery = useQuery<TrialBalance>({
    queryKey: ['accountant-trial-balance', propertyId, businessDate],
    queryFn: () => readApi(`/api/v1/night-audit/reports/trial-balance?propertyId=${propertyId}&businessDate=${businessDate}`),
    enabled: Boolean(propertyId && businessDate),
  });

  const receivablesQuery = useQuery<{ receivables: Receivable[] }>({
    queryKey: ['accountant-audit-receivables', propertyId],
    queryFn: () => readApi(`/api/v1/reports/receivables?propertyId=${propertyId}&minBalance=0`),
    enabled: Boolean(propertyId),
  });

  const refresh = () => {
    void statusQuery.refetch();
    void trialQuery.refetch();
    void receivablesQuery.refetch();
  };

  const executeAudit = async () => {
    if (!propertyId) return;
    setIsExecuting(true);
    try {
      const response = await fetch('/api/v1/night-audit/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.error?.message || body.error || 'Night Audit could not be started');
      setWizardOpen(false);
      toast.success('Night Audit completed successfully');
      refresh();
    } catch (error: any) {
      toast.error(error.message || 'Night Audit could not be started');
    } finally {
      setIsExecuting(false);
    }
  };

  if (statusQuery.isLoading) {
    return <div className="flex min-h-full items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }

  if (statusQuery.isError || !statusQuery.data) {
    return <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-slate-300"><FileWarning className="h-10 w-10 text-rose-400" /><p>Audit data could not be loaded.</p><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"><RefreshCw className="h-4 w-4" />Retry</button></div>;
  }

  const audit = statusQuery.data;
  const trial = trialQuery.data;
  const receivables = receivablesQuery.data?.receivables || [];
  const blockers = [
    ...(audit.system.openPosSessions || []).map((item: any) => ({ id: item.id, description: `Open POS session${item.outlet?.name ? ` — ${item.outlet.name}` : ''}`, amount: item.expectedCash, severity: 'HIGH' })),
    ...(audit.system.openFrontdeskSessions || []).map((item: any) => ({ id: item.id, description: `Open front-desk session — ${item.shiftReference || 'unreferenced'}`, amount: item.expectedCash, severity: 'HIGH' })),
    ...(audit.system.openPosOrders || []).map((item: any) => ({ id: item.id, description: `Unsettled POS order ${item.orderNumber || item.displayName || ''}`, amount: item.total, severity: 'HIGH' })),
    ...(audit.system.financialSyncConflicts || []).map((item: any) => ({ id: item.id, description: `Pending financial sync conflict — ${item.aggregateType || 'transaction'}`, amount: 0, severity: 'MEDIUM' })),
    ...(audit.financial.rateVariances || []).map((item: any) => ({ id: item.id, description: `Room-rate variance — ${item.folio?.reservation?.primaryGuest ? `${item.folio.reservation.primaryGuest.firstName} ${item.folio.reservation.primaryGuest.lastName}` : 'guest'}`, amount: Number(item.unitAmount || 0) - Number(item.baseAmount || 0), severity: 'MEDIUM' })),
  ];

  const stateLabel = audit.auditState.replaceAll('_', ' ');
  const stateClass = audit.auditState === 'COMPLETED' ? 'text-emerald-400' : audit.auditState === 'FAILED' ? 'text-rose-400' : 'text-amber-400';

  return (
    <div className="min-h-full space-y-6 bg-slate-950 p-6 text-slate-50 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-3xl font-bold tracking-tight text-emerald-400">Audit Workspace</h1><p className="mt-1 text-sm text-slate-400">Live night-audit readiness, trial balance, and receivables control.</p></div>
        <div className="flex gap-2"><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"><RefreshCw className="h-4 w-4" />Refresh</button><button onClick={() => setWizardOpen(true)} disabled={isExecuting || audit.auditState === 'IN_PROGRESS' || audit.auditState === 'POSTING'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight className="h-4 w-4" />Run Night Audit</button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Audit status" value={stateLabel} detail={`Business date: ${audit.businessDate}`} icon={<Clock className={stateClass} />} />
        <Metric title="Readiness blockers" value={audit.summary.blockers} detail={`${audit.summary.warnings} warnings`} icon={<ShieldAlert className="text-rose-400" />} />
        <Metric title="Trial balance" value={trial ? trial.totals.status : 'Loading'} detail={trial ? `Difference ${money(trial.totals.difference)}` : 'Loading live report'} icon={<FileCheck className={trial?.totals.status === 'BALANCED' ? 'text-emerald-400' : 'text-amber-400'} />} />
        <Metric title="Open receivables" value={receivables.length} detail={money(receivables.reduce((sum, item) => sum + Number(item.financials?.balance || 0), 0))} icon={<Wallet className="text-indigo-400" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="border-b border-white/10 p-5"><h2 className="flex items-center gap-2 font-semibold text-emerald-400"><AlertTriangle className="h-5 w-5" />Live audit exceptions</h2><p className="mt-1 text-xs text-slate-400">Open operational and financial items currently blocking or warning the audit.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase text-slate-400"><tr><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Severity</th></tr></thead><tbody className="divide-y divide-white/5">{blockers.length === 0 ? <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />No live audit blockers detected.</td></tr> : blockers.slice(0, 12).map(item => <tr key={item.id} className="hover:bg-white/[0.03]"><td className="px-5 py-3 text-slate-300">{item.description}</td><td className="px-5 py-3 text-right text-slate-300">{Number(item.amount || 0) ? money(item.amount) : '—'}</td><td className="px-5 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${item.severity === 'HIGH' ? 'border-rose-400/30 text-rose-400' : 'border-amber-400/30 text-amber-400'}`}>{item.severity}</span></td></tr>)}</tbody></table></div></section>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="border-b border-white/10 p-5"><h2 className="flex items-center gap-2 font-semibold text-emerald-400"><Wallet className="h-5 w-5" />Open folio balances</h2><p className="mt-1 text-xs text-slate-400">Live unsettled guest and city-ledger balances.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase text-slate-400"><tr><th className="px-5 py-3">Guest / Folio</th><th className="px-5 py-3">Room</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-white/5">{receivables.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No open folio balances.</td></tr> : receivables.slice(0, 12).map(item => <tr key={item.folioNumber} className="hover:bg-white/[0.03]"><td className="px-5 py-3"><div className="font-medium text-slate-200">{item.guest?.name || 'Unassigned guest'}</div><div className="text-xs text-slate-500">{item.folioNumber}</div></td><td className="px-5 py-3 text-slate-300">{item.reservation?.room || '—'}</td><td className="px-5 py-3 text-xs text-slate-400">{item.aging?.status?.replaceAll('_', ' ')}</td><td className="px-5 py-3 text-right font-medium text-amber-300">{money(item.financials.balance, item.financials.currency || 'NGN')}</td></tr>)}</tbody></table></div></section>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 className="font-semibold text-emerald-400">Trial balance</h2><p className="mt-1 text-xs text-slate-400">Generated for business date {audit.businessDate}.</p></div>{trial && <span className={`text-sm font-semibold ${trial.totals.status === 'BALANCED' ? 'text-emerald-400' : 'text-rose-400'}`}>{trial.totals.status} · Difference {money(trial.totals.difference)}</span>}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase text-slate-400"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Department</th><th className="px-5 py-3 text-right">Debit</th><th className="px-5 py-3 text-right">Credit</th></tr></thead><tbody className="divide-y divide-white/5">{trialQuery.isLoading ? <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">Loading trial balance…</td></tr> : (trial?.accounts || []).slice(0, 20).map(account => <tr key={account.accountCode} className="hover:bg-white/[0.03]"><td className="px-5 py-3"><span className="font-mono text-emerald-400">{account.accountCode}</span><span className="ml-3 text-slate-300">{account.accountName}</span></td><td className="px-5 py-3 text-slate-400">{account.department}</td><td className="px-5 py-3 text-right text-slate-300">{money(account.debit)}</td><td className="px-5 py-3 text-right text-slate-300">{money(account.credit)}</td></tr>)}</tbody></table></div></section>
      <AuditWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        data={audit}
        onExecute={executeAudit}
        executing={isExecuting}
        onRefresh={refresh}
      />
    </div>
  );
}

function Metric({ title, value, detail, icon }: { title: string; value: React.ReactNode; detail: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</span>{icon}</div><div className="mt-3 text-2xl font-bold text-white">{value}</div><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

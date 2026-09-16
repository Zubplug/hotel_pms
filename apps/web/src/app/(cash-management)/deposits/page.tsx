import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { DepositActionButton } from './deposit-action-button';
import { ensureCashierControlAccounts } from '@/lib/services/cash-account-service';
import { Landmark, AlertTriangle, Banknote, CheckCircle2, Clock3, Activity, ShieldCheck, TrendingUp } from 'lucide-react';

const statusMeta: Record<string, { label: string; classes: string }> = {
  RECONCILED: { label: 'Reconciled', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXCEPTION:  { label: 'Exception',  classes: 'bg-red-50 text-red-700 border-red-200' },
  DEPOSITED:  { label: 'Deposited',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING_HANDOVER: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default async function DepositsPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const ctx = await requireOrganizationContext(actor.user.id);
  const allowedProperties = ctx.propertyIds;
  const deposits = await prisma.bankDeposit.findMany({
    where: { propertyId: { in: [...allowedProperties] } },
    orderBy: { createdAt: 'desc' },
    include: {
      property: { select: { name: true } },
      allocations: {
        include: {
          posSession: { select: { controlStatus: true } },
          frontdeskSession: { select: { status: true } },
        },
      },
    },
  });
  const controlAccounts = await Promise.all(
    allowedProperties.map((propertyId) => ensureCashierControlAccounts(ctx, propertyId))
  );

  const selectedControlAccounts = allowedProperties.length === 1 ? controlAccounts[0] : [];
  const generalCashierSafe = selectedControlAccounts?.find((account) => account.type === 'SAFE');
  const cashInTransit = selectedControlAccounts?.find((account) => account.type === 'CASH_IN_TRANSIT');
  const pendingDeposits = deposits.filter((deposit) => deposit.status === 'PENDING_HANDOVER');
  const deposited = deposits.filter((deposit) => deposit.status === 'DEPOSITED');
  const reconciled = deposits.filter((deposit) => deposit.status === 'RECONCILED');
  const exceptions = deposits.filter((deposit) => deposit.status === 'EXCEPTION');
  const pipelineAmount = deposits.filter((deposit) => !['RECONCILED'].includes(deposit.status)).reduce((sum, deposit) => sum + Number(deposit.expectedAmount || 0), 0);
  const reconciledAmount = reconciled.reduce((sum, deposit) => sum + Number(deposit.expectedAmount || 0), 0);
  const exceptionAmount = exceptions.reduce((sum, deposit) => sum + Number(deposit.difference || 0), 0);

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1120] via-[#101d34] to-[#0b1120] px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Banking control</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Bank deposits</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Move received cash from custody to the bank with a complete submission and reconciliation trail.</p>
          </div>
          <div className="text-xs text-slate-400 sm:text-right">
            Deposits are prepared automatically after handover.
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Deposit pipeline', value: `₦${pipelineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, detail: `${pendingDeposits.length} pending handover`, icon: Banknote, tone: 'bg-amber-50 text-amber-700' },
            { label: 'Reconciled value', value: `₦${reconciledAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, detail: `${reconciled.length} reconciled deposits`, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Deposited', value: deposited.length, detail: 'Awaiting bank verification', icon: Clock3, tone: 'bg-blue-50 text-blue-700' },
            { label: 'Exceptions', value: exceptions.length, detail: exceptionAmount ? `₦${Math.abs(exceptionAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} difference` : 'No amount differences', icon: AlertTriangle, tone: exceptions.length ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500' },
          ].map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.detail}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>; })}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-600"><Activity className="h-4 w-4" />Deposit lifecycle</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Control pipeline</h2><p className="mt-1 text-sm text-slate-500">Every deposit should move from handover to verified bank receipt.</p></div><TrendingUp className="h-5 w-5 text-emerald-500" /></div><div className="mt-7 grid grid-cols-3 gap-3"><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Pending</p><p className="mt-2 text-2xl font-black text-slate-900">{pendingDeposits.length}</p><p className="mt-1 text-xs text-slate-500">Needs submission</p></div><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">Deposited</p><p className="mt-2 text-2xl font-black text-slate-900">{deposited.length}</p><p className="mt-1 text-xs text-slate-500">Needs verification</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Reconciled</p><p className="mt-2 text-2xl font-black text-slate-900">{reconciled.length}</p><p className="mt-1 text-xs text-slate-500">Control complete</p></div></div></section>
          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300"><ShieldCheck className="h-4 w-4" />Banking posture</div><h2 className="mt-2 text-lg font-semibold">Reconciliation readiness</h2><p className="mt-2 text-sm leading-6 text-slate-400">Deposits with differences remain visible as exceptions until the bank-confirmed amount is explained.</p><div className="mt-6 flex items-center justify-between rounded-xl bg-white/10 p-4"><span className="text-sm text-slate-300">Exception queue</span><span className={exceptions.length ? 'font-bold text-rose-300' : 'font-bold text-emerald-300'}>{exceptions.length ? `${exceptions.length} action${exceptions.length === 1 ? '' : 's'} needed` : 'Clear'}</span></div></section>
        </div>
        {allowedProperties.length === 1 && generalCashierSafe && cashInTransit && (
          <div className="mb-6 grid gap-3 md:grid-cols-2">
            {[
              { account: generalCashierSafe, label: 'General Cashier Safe', detail: 'Central custody for received handovers', tone: 'border-indigo-200 bg-indigo-50/60 text-indigo-700' },
              { account: cashInTransit, label: 'Cash in Transit', detail: 'Cash staged for banking and reconciliation', tone: 'border-amber-200 bg-amber-50/60 text-amber-700' },
            ].map(({ account, label, detail, tone }) => (
              <div key={account.id} className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${tone}`}>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 text-xs opacity-75">{detail}</p>
                </div>
                <p className="text-lg font-bold">₦{Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Deposit register
              </span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {deposits.length}
              </span>
            </div>
          </div>

          {deposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Landmark className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No deposits yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Deposits will appear here once cash handovers are bundled for banking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Reference', 'Property', 'Bank / Account', 'Expected', 'Difference', 'Status', 'Shifts', 'Date', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                            i >= 3 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((d) => {
                    const diff = Number(d.difference);
                    const meta =
                      statusMeta[d.status] ?? { label: d.status, classes: 'bg-slate-100 text-slate-700 border-slate-200' };
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                          {d.depositReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{d.property.name}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {d.bankName || '—'} / {d.bankAccount || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{Number(d.expectedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        >
                          {d.difference !== null
                            ? `₦${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {d.allocations.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DepositActionButton depositId={d.id} propertyId={d.propertyId} currentStatus={d.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

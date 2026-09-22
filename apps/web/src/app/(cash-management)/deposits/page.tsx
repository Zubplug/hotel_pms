import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { DepositActionButton } from './deposit-action-button';
import { SubmitAvailableCashButton } from './submit-available-cash-button';
import { ensureCashierControlAccounts } from '@/lib/services/cash-account-service';
import { Landmark, AlertTriangle, Banknote, CheckCircle2, Clock3, Activity, ShieldCheck, TrendingUp } from 'lucide-react';

const statusMeta: Record<string, { label: string; classes: string }> = {
  RECONCILED: { label: 'Reconciled', classes: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
  EXCEPTION:  { label: 'Exception',  classes: 'bg-rose-400/10 text-rose-300 border-rose-400/20' },
  DEPOSITED:  { label: 'Deposited',  classes: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20' },
  PENDING_HANDOVER: { label: 'Awaiting bank submission', classes: 'bg-amber-400/10 text-amber-300 border-amber-400/20' },
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
  const availableCash = Number(generalCashierSafe?.balance || 0) + Number(cashInTransit?.balance || 0);
  const pendingDeposits = deposits.filter((deposit) => deposit.status === 'PENDING_HANDOVER');
  const deposited = deposits.filter((deposit) => deposit.status === 'DEPOSITED');
  const reconciled = deposits.filter((deposit) => deposit.status === 'RECONCILED');
  const exceptions = deposits.filter((deposit) => deposit.status === 'EXCEPTION');
  const openDepositStatuses = ['PENDING_HANDOVER', 'HANDED_OVER', 'UNDER_RECONCILIATION', 'EXCEPTION'];
  const pipelineAmount = deposits.filter((deposit) => openDepositStatuses.includes(deposit.status)).reduce((sum, deposit) => sum + Number(deposit.expectedAmount || 0), 0);
  const reconciledAmount = reconciled.reduce((sum, deposit) => sum + Number(deposit.expectedAmount || 0), 0);
  const exceptionAmount = exceptions.reduce((sum, deposit) => sum + Number(deposit.difference || 0), 0);
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - 6);
  const depositTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const dayDeposits = deposits.filter((deposit) => new Date(deposit.createdAt).toISOString().slice(0, 10) === key);
    return { date, count: dayDeposits.length, amount: dayDeposits.reduce((sum, deposit) => sum + Number(deposit.expectedAmount || 0), 0) };
  });
  const depositTrendMax = Math.max(...depositTrend.map((day) => day.amount), 1);

  return (
    <div className="cashier-dark-surface min-h-full bg-[#07111f]">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1120] via-[#101d34] to-[#0b1120] px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Banking control</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Bank deposits</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Move received cash from custody to the bank with a complete submission and reconciliation trail.</p>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-slate-400 sm:items-end sm:text-right">
            <span>Deposits are prepared automatically after handover.</span>
            {allowedProperties.length === 1 && pendingDeposits.length === 0 && availableCash > 0 && <SubmitAvailableCashButton propertyId={allowedProperties[0]} availableAmount={availableCash} />}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-6 bg-[#08111f] px-5 py-7 text-slate-100 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Open bank batch', value: `₦${pipelineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, detail: `${pendingDeposits.length} batch${pendingDeposits.length === 1 ? '' : 'es'} awaiting submission`, icon: Banknote, tone: 'bg-amber-400/10 text-amber-300' },
            { label: 'Reconciled value', value: `₦${reconciledAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, detail: `${reconciled.length} reconciled deposits`, icon: CheckCircle2, tone: 'bg-emerald-400/10 text-emerald-300' },
            { label: 'Deposited', value: deposited.length, detail: 'Awaiting bank verification', icon: Clock3, tone: 'bg-cyan-400/10 text-cyan-300' },
            { label: 'Exceptions', value: exceptions.length, detail: exceptionAmount ? `₦${Math.abs(exceptionAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} difference` : 'No amount differences', icon: AlertTriangle, tone: exceptions.length ? 'bg-rose-400/10 text-rose-300' : 'bg-white/10 text-slate-400' },
          ].map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-[0_12px_30px_rgba(0,0,0,.12)]"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-black text-white">{card.value}</p><p className="mt-1 text-xs text-slate-500">{card.detail}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>; })}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-6 shadow-[0_12px_30px_rgba(0,0,0,.12)]"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300"><Activity className="h-4 w-4" />Deposit lifecycle</div><h2 className="mt-1 text-lg font-semibold text-white">Seven-day bank pipeline</h2><p className="mt-1 text-sm text-slate-400">Live expected value entering the bank workflow by day.</p></div><TrendingUp className="h-5 w-5 text-emerald-300" /></div><div className="mt-7 flex h-32 items-end gap-3">{depositTrend.map((day) => <div key={day.date.toISOString()} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="relative flex h-full w-full items-end justify-center"><span className="absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-[#07101e] px-1.5 py-0.5 text-[10px] text-white group-hover:block">₦{day.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {day.count}</span><div className="w-full max-w-12 rounded-t-lg bg-emerald-400/40 transition group-hover:bg-cyan-300" style={{ height: `${Math.max((day.amount / depositTrendMax) * 100, day.amount ? 12 : 4)}%` }} /></div><span className="text-[10px] font-semibold uppercase text-slate-500">{day.date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3)}</span></div>)}</div><div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl border border-amber-400/10 bg-amber-400/[.08] p-3"><p className="text-xs font-semibold text-amber-300">Awaiting submission</p><p className="mt-1 text-xl font-black text-white">{pendingDeposits.length}</p></div><div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[.08] p-3"><p className="text-xs font-semibold text-cyan-300">Deposited</p><p className="mt-1 text-xl font-black text-white">{deposited.length}</p></div><div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.08] p-3"><p className="text-xs font-semibold text-emerald-300">Reconciled</p><p className="mt-1 text-xl font-black text-white">{reconciled.length}</p></div></div></section>
          <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-6 text-white shadow-[0_12px_30px_rgba(0,0,0,.12)]"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300"><ShieldCheck className="h-4 w-4" />Banking posture</div><h2 className="mt-2 text-lg font-semibold">Reconciliation readiness</h2><p className="mt-2 text-sm leading-6 text-slate-400">Deposits with differences remain visible as exceptions until the bank-confirmed amount is explained.</p><div className="mt-6 flex items-center justify-between rounded-xl bg-white/[.06] p-4"><span className="text-sm text-slate-300">Exception queue</span><span className={exceptions.length ? 'font-bold text-rose-300' : 'font-bold text-emerald-300'}>{exceptions.length ? `${exceptions.length} action${exceptions.length === 1 ? '' : 's'} needed` : 'Clear'}</span></div></section>
        </div>
        {allowedProperties.length === 1 && generalCashierSafe && cashInTransit && (
          <div className="mb-6 grid gap-3 md:grid-cols-2">
            {[
              { account: generalCashierSafe, label: 'General Cashier Safe', detail: 'Central custody for received handovers', tone: 'border-indigo-400/20 bg-indigo-400/[.08] text-indigo-200' },
              { account: cashInTransit, label: 'Cash in Transit', detail: 'Cash staged for banking and reconciliation', tone: 'border-amber-400/20 bg-amber-400/[.08] text-amber-200' },
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
        {allowedProperties.length === 1 && availableCash <= 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] px-5 py-4 text-sm text-slate-400 shadow-sm">No cash is currently available for bank submission. Received cash will appear here after the cashier custody workflow posts it.</div>
        )}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] shadow-sm">
          {/* Table header bar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[.03] px-6 py-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-200">
                Deposit register
              </span>
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 px-1.5 text-xs font-bold text-slate-300">
                {deposits.length}
              </span>
            </div>
          </div>

          {deposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <Landmark className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No deposits yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Deposits will appear here once cash handovers are bundled for banking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[.03]">
                    {['Reference', 'Property', 'Bank / Account', 'Expected', 'Difference', 'Status', 'Shifts', 'Date', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 ${
                            i >= 3 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.06]">
                  {deposits.map((d) => {
                    const diff = Number(d.difference);
                      const meta =
                      statusMeta[d.status] ?? { label: d.status, classes: 'bg-white/10 text-slate-300 border-white/10' };
                    return (
                      <tr key={d.id} className="group transition-colors hover:bg-white/[.04]">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-200">
                          {d.depositReference}
                        </td>
                        <td className="px-6 py-4 text-slate-300">{d.property.name}</td>
                        <td className="px-6 py-4 text-slate-300">
                          {d.bankName || d.bankAccount ? `${d.bankName || 'Bank'} / ${d.bankAccount || 'Account pending'}` : <span className="text-amber-300">Unassigned · select on submission</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-200">
                          ₦{Number(d.expectedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            diff < 0 ? 'text-rose-300' : diff > 0 ? 'text-cyan-300' : 'text-slate-500'
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
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
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
                          <DepositActionButton depositId={d.id} propertyId={d.propertyId} currentStatus={d.status} allowSubmit />
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

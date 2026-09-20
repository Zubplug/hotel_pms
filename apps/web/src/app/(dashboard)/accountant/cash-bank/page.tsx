import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  FileCheck2,
  Landmark,
  Link2,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
import { GLMappingTab } from '@/components/accountant/GLMappingTab';
import { RecordCashDropModal } from '@/components/accountant/RecordCashDropModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(amount);

const dateLabel = (value: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value);
const dayKey = (value: Date) => value.toISOString().slice(0, 10);

function statusClass(status: string) {
  if (['RECONCILED', 'APPROVED', 'PAID', 'CLOSED', 'HANDED_OVER'].includes(status)) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (['EXCEPTION', 'RETURNED', 'REJECTED'].includes(status)) return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
  return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
}

export default async function CashBankPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fcash-bank');
  const propertyId = session.user.propertyId;
  if (!propertyId) return <main className="p-8 text-slate-500">No property is assigned to this account.</main>;

  const [property, cashAccounts, deposits, expenses, posSessions, frontdeskSessions, payments, posPayments, supplierPayments, pendingJournals] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } }),
    prisma.cashAccount.findMany({ where: { propertyId, isActive: true }, include: { glAccount: { select: { code: true, name: true, type: true } } }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.bankDeposit.findMany({ where: { propertyId }, include: { allocations: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.cashExpense.findMany({ where: { propertyId }, include: { cashAccount: { select: { name: true } }, journal: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.posSession.findMany({ where: { outlet: { propertyId } }, include: { outlet: true, primaryOperator: true }, orderBy: { businessDate: 'desc' }, take: 12 }),
    prisma.frontdeskSession.findMany({ where: { propertyId }, include: { staff: true, cashAccount: true }, orderBy: { businessDate: 'desc' }, take: 12 }),
    prisma.payment.findMany({ where: { propertyId, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, select: { amount: true, businessDate: true, method: true }, orderBy: { businessDate: 'desc' }, take: 1000 }),
    prisma.posPayment.findMany({ where: { order: { propertyId }, status: 'CONFIRMED' }, select: { amount: true, businessDate: true, method: true }, orderBy: { businessDate: 'desc' }, take: 1000 }),
    prisma.supplierPayment.findMany({ where: { propertyId }, select: { amount: true, paymentDate: true, paymentMethod: true }, orderBy: { paymentDate: 'desc' }, take: 500 }),
    prisma.journalEntry.count({ where: { propertyId, status: 'DRAFT' } }),
  ]);

  const currency = property?.baseCurrency || 'NGN';
  const businessDate = property?.businessDate || new Date();
  const cashBalance = cashAccounts.filter(account => account.type !== 'BANK_ACCOUNT' && account.type !== 'EXTERNAL').reduce((sum, account) => sum + Number(account.balance), 0);
  const bankBalance = cashAccounts.filter(account => account.type === 'BANK_ACCOUNT').reduce((sum, account) => sum + Number(account.balance), 0);
  const transitBalance = cashAccounts.filter(account => account.type === 'CASH_IN_TRANSIT').reduce((sum, account) => sum + Number(account.balance), 0);
  const pendingDeposits = deposits.filter(deposit => !['RECONCILED', 'CANCELLED', 'REJECTED'].includes(deposit.status));
  const exceptions = deposits.filter(deposit => deposit.status === 'EXCEPTION');
  const pendingExpenses = expenses.filter(expense => ['PENDING_APPROVAL', 'APPROVED'].includes(expense.status));
  const unpostedCashExpenses = expenses.filter(expense => expense.status === 'PAID' && !expense.journal);
  const openShifts = posSessions.filter(shift => !['CLOSED', 'RECONCILED', 'DEPOSITED'].includes(shift.controlStatus));
  const openFrontdesk = frontdeskSessions.filter(shift => !['CLOSED', 'RECONCILED', 'HANDED_OVER', 'DEPOSITED'].includes(shift.status));

  const trendDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(businessDate);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    const key = dayKey(date);
    const inflow = payments.filter(payment => dayKey(payment.businessDate) === key).reduce((sum, payment) => sum + Number(payment.amount), 0)
      + posPayments.filter(payment => dayKey(payment.businessDate) === key).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outflow = expenses.filter(expense => expense.paidAt && dayKey(expense.paidAt) === key && expense.status === 'PAID').reduce((sum, expense) => sum + Number(expense.amount), 0)
      + supplierPayments.filter(payment => dayKey(payment.paymentDate) === key).reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { date, label: new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(date), inflow, outflow, net: inflow - outflow };
  });
  const trendMax = Math.max(...trendDays.flatMap(day => [day.inflow, day.outflow]), 1);
  const todayInflow = trendDays[trendDays.length - 1]?.inflow || 0;
  const todayOutflow = trendDays[trendDays.length - 1]?.outflow || 0;

  return (
    <main className="min-h-full bg-[#08111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300"><CircleDollarSign className="h-4 w-4" />Treasury control room</div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Cash and bank, reconciled.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">A live view of custody, deposits in transit, operating bank balances, payment flows, and the exceptions that need an accountant’s decision.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{dateLabel(businessDate)}</strong></span>
            {posSessions.length > 0 && <RecordCashDropModal posSessions={posSessions} />}
            <Link href="/cash-management/deposits" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[.1]"><Landmark className="h-4 w-4" />Deposit control</Link>
            <Link href="/accountant/gl" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"><FileCheck2 className="h-4 w-4" />Open GL</Link>
          </div>
        </header>

        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.055] px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-white">Cash close posture</p><p className="mt-1 text-xs text-slate-400">{exceptions.length ? `${exceptions.length} deposit exception${exceptions.length === 1 ? '' : 's'} require investigation.` : pendingDeposits.length ? `${pendingDeposits.length} deposit${pendingDeposits.length === 1 ? '' : 's'} remain in the banking pipeline.` : 'No unresolved deposit exceptions are recorded.'}</p></div></div>
          <Link href="/cash-management/deposits" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Review deposit register <ArrowRight className="h-3.5 w-3.5" /></Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Cash custody', value: money(cashBalance, currency), detail: `${cashAccounts.filter(a => a.type !== 'BANK_ACCOUNT' && a.type !== 'EXTERNAL').length} active control accounts`, icon: Wallet, tone: 'text-emerald-300 bg-emerald-400/10' },
            { label: 'Operating bank', value: money(bankBalance, currency), detail: `${cashAccounts.filter(a => a.type === 'BANK_ACCOUNT').length} configured bank accounts`, icon: Landmark, tone: 'text-cyan-300 bg-cyan-400/10' },
            { label: 'Cash in transit', value: money(transitBalance, currency), detail: `${pendingDeposits.length} deposits not reconciled`, icon: Banknote, tone: 'text-amber-300 bg-amber-400/10' },
            { label: 'Today net movement', value: money(todayInflow - todayOutflow, currency), detail: `${money(todayInflow, currency)} in · ${money(todayOutflow, currency)} out`, icon: todayInflow >= todayOutflow ? ArrowUpRight : ArrowDownRight, tone: todayInflow >= todayOutflow ? 'text-emerald-300 bg-emerald-400/10' : 'text-rose-300 bg-rose-400/10' },
            { label: 'Control actions', value: String(exceptions.length + pendingExpenses.length + openShifts.length + openFrontdesk.length), detail: `${pendingJournals} draft journals · ${unpostedCashExpenses.length} paid expenses without journal`, icon: AlertTriangle, tone: exceptions.length || unpostedCashExpenses.length ? 'text-rose-300 bg-rose-400/10' : 'text-slate-300 bg-white/10' },
          ].map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[.045] p-5 shadow-[0_18px_60px_rgba(0,0,0,.12)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{card.value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{card.detail}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>; })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300"><RefreshCcw className="h-4 w-4" />14-day cash movement</div><h2 className="mt-1 text-lg font-semibold text-white">Inflow, outflow, and net direction</h2><p className="mt-1 text-xs text-slate-500">Live completed folio/POS receipts less paid cash expenses and supplier payments.</p></div><Link href="/accountant/gl" className="text-xs font-semibold text-cyan-300">View journals <ChevronRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-6 flex h-48 items-end gap-1.5 sm:gap-2">{trendDays.map(day => <div key={day.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-36 w-full items-end justify-center gap-0.5"><span title={`${day.label} inflow ${money(day.inflow, currency)}`} className="w-1/2 rounded-t bg-cyan-400/80" style={{ height: `${Math.max((day.inflow / trendMax) * 100, day.inflow ? 3 : 0)}%` }} /><span title={`${day.label} outflow ${money(day.outflow, currency)}`} className="w-1/2 rounded-t bg-rose-400/70" style={{ height: `${Math.max((day.outflow / trendMax) * 100, day.outflow ? 3 : 0)}%` }} /></div><span className="truncate text-[10px] text-slate-600">{day.label}</span></div>)}</div><div className="mt-4 flex gap-5 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />Inflow</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Outflow</span><span className="ml-auto font-medium text-slate-300">Net 14d {money(trendDays.reduce((sum, day) => sum + day.net, 0), currency)}</span></div></div>
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-amber-300"><AlertTriangle className="h-4 w-4" />Decision queue</div><h2 className="mt-1 text-lg font-semibold text-white">What needs attention</h2><div className="mt-5 space-y-2">{[
            { label: 'Deposit exceptions', count: exceptions.length, href: '/cash-management/deposits', tone: exceptions.length ? 'text-rose-300' : 'text-emerald-300' },
            { label: 'Cash expenses awaiting action', count: pendingExpenses.length, href: '/cash-management/expenses', tone: pendingExpenses.length ? 'text-amber-300' : 'text-emerald-300' },
            { label: 'Shifts not fully controlled', count: openShifts.length + openFrontdesk.length, href: '/cash-management/handovers', tone: openShifts.length + openFrontdesk.length ? 'text-amber-300' : 'text-emerald-300' },
            { label: 'Draft GL journals', count: pendingJournals, href: '/accountant/gl', tone: pendingJournals ? 'text-amber-300' : 'text-emerald-300' },
          ].map(item => <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 hover:bg-white/[.08]"><span className="text-xs text-slate-300">{item.label}</span><span className={`text-sm font-semibold ${item.tone}`}>{item.count}<ChevronRight className="ml-1 inline h-3.5 w-3.5" /></span></Link>)}</div></div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-emerald-300"><Landmark className="h-4 w-4" />Account portfolio</div><h2 className="mt-1 text-lg font-semibold text-white">Cash and bank accounts</h2><p className="mt-1 text-xs text-slate-500">Balances are read from the operational cash subledger and linked GL account.</p></div><Link href="/cash-management/deposits" className="text-xs font-semibold text-cyan-300">Manage deposits <ArrowRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-[.14em] text-slate-600"><th className="pb-3">Account</th><th className="pb-3">Type</th><th className="pb-3">GL mapping</th><th className="pb-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-white/[.06]">{cashAccounts.length ? cashAccounts.map(account => <tr key={account.id} className="group"><td className="py-3"><p className="font-medium text-slate-200">{account.name}</p><p className="text-[11px] text-slate-600">{account.bankName || account.accountNumber || account.id.slice(0, 8)}</p></td><td className="py-3 text-xs text-slate-500">{account.type.replaceAll('_', ' ')}</td><td className="py-3 text-xs">{account.glAccount ? <span className="text-emerald-300">{account.glAccount.code} · {account.glAccount.name}</span> : <span className="text-amber-300">Mapping required</span>}</td><td className="py-3 text-right font-semibold text-slate-200">{money(Number(account.balance), currency)}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-600">No active cash or bank accounts are configured.</td></tr>}</tbody></table></div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-indigo-300"><Banknote className="h-4 w-4" />Banking pipeline</div><h2 className="mt-1 text-lg font-semibold text-white">Recent deposits</h2></div><Link href="/cash-management/deposits" className="text-xs font-semibold text-cyan-300">Open register</Link></div><div className="mt-5 space-y-2">{deposits.slice(0, 6).map(deposit => <Link key={deposit.id} href="/cash-management/deposits" className="flex items-center justify-between rounded-xl border border-white/[.08] px-3 py-3 hover:bg-white/[.05]"><div><p className="font-mono text-xs font-semibold text-slate-200">{deposit.depositReference}</p><p className="mt-1 text-[11px] text-slate-600">{deposit.bankName || 'Bank not selected'} · {deposit.allocations.length} shift{deposit.allocations.length === 1 ? '' : 's'}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-200">{money(Number(deposit.expectedAmount), currency)}</p><span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(deposit.status)}`}>{deposit.status.replaceAll('_', ' ')}</span></div></Link>)}{deposits.length === 0 && <p className="py-10 text-center text-sm text-slate-600">No bank deposits recorded.</p>}</div></div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><Coins className="h-4 w-4" />Petty cash control</div><h2 className="mt-1 text-lg font-semibold text-white">Recent cash expenses</h2><p className="mt-1 text-xs text-slate-500">Approval and payment status from the cash-expense subledger.</p></div><Link href="/cash-management/expenses" className="text-xs font-semibold text-cyan-300">Open expense workspace <ArrowRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-[.14em] text-slate-600"><th className="pb-3">Expense</th><th className="pb-3">Status</th><th className="pb-3">Paid from</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-white/[.06]">{expenses.slice(0, 6).map(expense => <tr key={expense.id}><td className="py-3"><p className="font-medium text-slate-200">{expense.payee}</p><p className="text-[11px] text-slate-600">{expense.expenseReference} · {expense.category}</p></td><td className="py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(expense.status)}`}>{expense.status.replaceAll('_', ' ')}</span></td><td className="py-3 text-xs text-slate-500">{expense.cashAccount?.name || 'Not paid'}</td><td className="py-3 text-right font-semibold text-slate-200">{money(Number(expense.amount), expense.currency || currency)}</td></tr>)}{expenses.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-600">No cash expenses recorded.</td></tr>}</tbody></table></div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-slate-400"><Wallet className="h-4 w-4" />Shift custody</div><h2 className="mt-1 text-lg font-semibold text-white">Open control points</h2><div className="mt-5 space-y-3">{[...posSessions.slice(0, 3).map(shift => ({ id: shift.id, label: shift.outlet.name, owner: shift.primaryOperator ? `${shift.primaryOperator.firstName} ${shift.primaryOperator.lastName}` : 'Operator not assigned', status: shift.controlStatus, amount: Number(shift.expectedCash || 0) })), ...frontdeskSessions.slice(0, 3).map(shift => ({ id: shift.id, label: 'Front desk', owner: shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : 'Staff not assigned', status: shift.status, amount: Number(shift.systemExpectedCash || 0) }))].map(shift => <div key={shift.id} className="flex items-center justify-between rounded-xl border border-white/[.08] px-3 py-3"><div><p className="text-sm font-medium text-slate-200">{shift.label}</p><p className="mt-1 text-[11px] text-slate-600">{shift.owner} · expected {money(shift.amount, currency)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(shift.status)}`}>{shift.status.replaceAll('_', ' ')}</span></div>)}{!posSessions.length && !frontdeskSessions.length && <p className="py-10 text-center text-sm text-slate-600">No shift-control records are available.</p>}</div><Link href="/cash-management/handovers" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">Review handovers <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300"><Link2 className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold text-white">GL control and mapping</h2><p className="mt-1 text-xs text-slate-500">Every physical cash and bank account should point to one asset account before settlement or deposit posting.</p></div></div><div className="mt-5"><GLMappingTab cashAccounts={cashAccounts} chartOfAccounts={await prisma.chartOfAccount.findMany({ where: { propertyId, type: 'ASSET' }, orderBy: { code: 'asc' } })} /></div></section>

        <footer className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-xs text-slate-600 sm:flex-row"><span>Live source: operational cash subledger, deposit register, payment register, AP payments, and GL control records.</span><span>As of {dateLabel(businessDate)}</span></footer>
      </div>
    </main>
  );
}

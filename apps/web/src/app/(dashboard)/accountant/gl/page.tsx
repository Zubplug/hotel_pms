import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Scale,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';
import { NewJournalEntryModal } from '@/components/accountant/NewJournalEntryModal';
import { NewPeriodModal } from '@/components/accountant/NewPeriodModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value);
const dayKey = (value: Date) => value.toISOString().slice(0, 10);
const startOfMonth = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const accountTypeLabels: Record<string, string> = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses' };
const typeColors: Record<string, string> = { ASSET: 'text-cyan-300', LIABILITY: 'text-amber-300', EQUITY: 'text-violet-300', REVENUE: 'text-emerald-300', EXPENSE: 'text-rose-300' };

export default async function GeneralLedgerPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fgl');
  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = session.user.propertyId && propertyIds.includes(session.user.propertyId) ? session.user.propertyId : propertyIds[0];
  if (!propertyId) return <EmptyState title="No property assigned" />;

  const [property, accounts, periods, journals, postedLines] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } }),
    prisma.chartOfAccount.findMany({ where: { propertyId }, orderBy: { code: 'asc' } }),
    prisma.accountingPeriod.findMany({ where: { propertyId }, orderBy: { periodStart: 'desc' }, take: 18 }),
    prisma.journalEntry.findMany({
      where: { propertyId },
      include: { lines: { include: { account: { select: { code: true, name: true, type: true, normalBalance: true } } } }, period: { select: { name: true } } },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    prisma.journalEntryLine.findMany({
      where: { entry: { propertyId, status: 'POSTED' } },
      select: { debit: true, credit: true, sourceType: true, accountId: true, entry: { select: { entryDate: true, source: true } } },
    }),
  ]);

  const currency = property?.baseCurrency || 'NGN';
  const businessDate = property?.businessDate || new Date();
  const activePeriod = periods.find(period => period.periodStart <= businessDate && period.periodEnd >= businessDate);
  const openPeriods = periods.filter(period => period.status === 'OPEN');
  const postedJournals = journals.filter(entry => entry.status === 'POSTED');
  const draftJournals = journals.filter(entry => entry.status === 'DRAFT');
  const postedDebits = postedLines.reduce((sum, line) => sum + Number(line.debit), 0);
  const postedCredits = postedLines.reduce((sum, line) => sum + Number(line.credit), 0);
  const trialDifference = Number((postedDebits - postedCredits).toFixed(2));
  const activeAccounts = accounts.filter(account => account.isActive);
  const unmappedAccounts = activeAccounts.filter(account => !postedLines.some(line => line.accountId === account.id));

  const byType = new Map<string, { debit: number; credit: number; balance: number; count: number }>();
  for (const type of ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) byType.set(type, { debit: 0, credit: 0, balance: 0, count: 0 });
  for (const line of postedLines) {
    const account = accounts.find(item => item.id === line.accountId);
    if (!account) continue;
    const item = byType.get(account.type) || { debit: 0, credit: 0, balance: 0, count: 0 };
    item.debit += Number(line.debit);
    item.credit += Number(line.credit);
    item.balance += account.normalBalance === 'CREDIT' ? Number(line.credit) - Number(line.debit) : Number(line.debit) - Number(line.credit);
    item.count += 1;
    byType.set(account.type, item);
  }

  const accountRows = accounts.map(account => {
    const lines = postedLines.filter(line => line.accountId === account.id);
    const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
    return { ...account, debit, credit, balance: account.normalBalance === 'CREDIT' ? credit - debit : debit - credit, activity: lines.length };
  }).filter(account => account.activity > 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 10);

  const monthStart = startOfMonth(businessDate);
  const monthPosted = postedLines.filter(line => line.entry.entryDate >= monthStart && line.entry.entryDate <= businessDate);
  const monthDebit = monthPosted.reduce((sum, line) => sum + Number(line.debit), 0);
  const monthCredit = monthPosted.reduce((sum, line) => sum + Number(line.credit), 0);
  const sourceMix = Array.from(postedJournals.reduce((map, entry) => map.set(entry.source, (map.get(entry.source) || 0) + 1), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(businessDate);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    const entries = postedJournals.filter(entry => dayKey(entry.entryDate) === dayKey(date));
    return { label: new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(date), debit: entries.reduce((sum, entry) => sum + Number(entry.totalDebit), 0), count: entries.length };
  });
  const maxTrend = Math.max(...trend.map(item => item.debit), 1);
  const closeChecks = [
    { label: 'Trial balance', detail: trialDifference === 0 ? 'Total debits equal total credits.' : `Difference of ${money(Math.abs(trialDifference), currency)} requires investigation.`, ok: trialDifference === 0 },
    { label: 'Business-date period', detail: activePeriod ? `${activePeriod.name} is ${activePeriod.status.toLowerCase()}.` : 'No accounting period covers the business date.', ok: Boolean(activePeriod && activePeriod.status === 'OPEN') },
    { label: 'Draft journals', detail: draftJournals.length ? `${draftJournals.length} journal${draftJournals.length === 1 ? '' : 's'} are not posted.` : 'No draft journals are waiting to be posted.', ok: draftJournals.length === 0 },
    { label: 'Account activity', detail: `${activeAccounts.length} active accounts; ${unmappedAccounts.length} have no posted activity.`, ok: true },
  ];

  return <main className="min-h-full bg-[#08111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1540px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-300"><BookOpen className="h-4 w-4" />General ledger control room</div><h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Every posting, in balance.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">A live close view of trial-balance integrity, period control, journal production, account movement, and the posting exceptions that need an accountant’s decision.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{dateLabel(businessDate)}</strong></span><NewPeriodModal propertyId={propertyId} /><NewJournalEntryModal propertyId={propertyId} accounts={accounts.map(account => ({ id: account.id, name: account.name, code: account.code }))} /></div></header>

    <section className={`flex flex-col justify-between gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center ${trialDifference === 0 && activePeriod?.status === 'OPEN' ? 'border-emerald-400/15 bg-emerald-400/[.055]' : 'border-amber-400/20 bg-amber-400/[.06]'}`}><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${trialDifference === 0 && activePeriod?.status === 'OPEN' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{trialDifference === 0 && activePeriod?.status === 'OPEN' ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><p className="text-sm font-semibold text-white">GL close posture: {closeChecks.filter(item => item.ok).length}/{closeChecks.length} controls healthy</p><p className="mt-1 text-xs text-slate-400">{trialDifference === 0 ? 'The posted ledger is balanced.' : 'The posted ledger is out of balance and should not be finalized.'} {activePeriod ? `Current period: ${activePeriod.name}.` : 'Open an accounting period before posting.'}</p></div></div><Link href="/accountant/audit" className="inline-flex items-center gap-2 text-xs font-semibold text-violet-300 hover:text-violet-200">Open audit controls <ArrowRight className="h-3.5 w-3.5" /></Link></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Trial balance" value={trialDifference === 0 ? 'Balanced' : money(Math.abs(trialDifference), currency)} detail={`${money(postedDebits, currency)} debits · ${money(postedCredits, currency)} credits`} icon={Scale} tone={trialDifference === 0 ? 'emerald' : 'rose'} /><Metric label="Posted journals" value={postedJournals.length.toLocaleString()} detail={`${monthPosted.length ? monthPosted.length : 0} lines this month`} icon={CheckCircle2} tone="cyan" /><Metric label="Draft journals" value={draftJournals.length.toLocaleString()} detail="Waiting for controlled posting" icon={FileCheck2} tone={draftJournals.length ? 'amber' : 'emerald'} /><Metric label="Month activity" value={money(monthDebit, currency)} detail={`${money(monthCredit, currency)} credit movement`} icon={Activity} tone="violet" /><Metric label="Chart of accounts" value={activeAccounts.length.toLocaleString()} detail={`${unmappedAccounts.length} without posted activity`} icon={WalletCards} tone="cyan" /><Metric label="Open periods" value={openPeriods.length.toLocaleString()} detail={activePeriod ? activePeriod.name : 'No current period'} icon={LockKeyhole} tone={activePeriod?.status === 'OPEN' ? 'emerald' : 'amber'} /></section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Journal production" subtitle="Posted debit value and journal volume across the last 14 business days"><div className="flex h-52 items-end gap-1.5 sm:gap-2">{trend.map(item => <div key={item.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-40 w-full items-end justify-center"><span title={`${item.label} ${money(item.debit, currency)}`} className="w-full rounded-t bg-violet-400/80" style={{ height: `${Math.max(item.debit / maxTrend * 100, item.debit ? 3 : 0)}%` }} /></div><span className="truncate text-[10px] text-slate-600">{item.label}</span></div>)}</div><div className="mt-4 flex items-center gap-5 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" />Posted debit value</span><span className="ml-auto">14-day journals {trend.reduce((sum, item) => sum + item.count, 0)}</span></div></Panel><Panel title="Posting source mix" subtitle="Live journal origins across the posted ledger"><div className="space-y-3">{sourceMix.length ? sourceMix.map(([source, count], index) => <div key={source}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-300"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[.06] text-[10px] text-slate-500">{index + 1}</span>{source.replaceAll('_', ' ')}</span><strong className="text-white">{count}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${count / Math.max(sourceMix[0]?.[1] || 1, 1) * 100}%` }} /></div></div>) : <EmptyInline text="No posted journal source activity." />}</div></Panel></section>

    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Trial balance by account class" subtitle="Posted debit, credit, and normal-balance position"><div className="space-y-3">{Array.from(byType.entries()).map(([type, item]) => <div key={type} className="rounded-xl border border-white/[.08] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-3"><span className={`text-sm font-medium ${typeColors[type]}`}>{accountTypeLabels[type]}</span><strong className="text-sm text-white">{money(item.balance, currency)}</strong></div><div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>Dr {money(item.debit, currency)}</span><span>Cr {money(item.credit, currency)}</span><span>{item.count} lines</span></div></div>)}</div></Panel><Panel title="Close controls" subtitle="Pre-close checks for the current business date"><div className="space-y-3">{closeChecks.map(check => <div key={check.label} className="flex items-start gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${check.ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{check.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div><div className="text-xs font-semibold text-slate-200">{check.label}</div><div className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</div></div></div>)}</div></Panel></section>

    <section className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><Panel title="Recent journal register" subtitle="Latest journals across manual and automated accounting sources" action={<Link href="/accountant/audit" className="text-xs font-semibold text-violet-300">Audit trail <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="px-1 py-3">Entry</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Description</th><th className="px-1 py-3 text-right">Amount</th><th className="px-1 py-3 text-right">Status</th></tr></thead><tbody className="divide-y divide-white/[.06]">{journals.slice(0, 8).map(entry => <tr key={entry.id} className="transition hover:bg-white/[.03]"><td className="px-1 py-3 font-mono text-xs text-violet-300">{entry.entryNumber}</td><td className="px-3 py-3 text-xs text-slate-400">{dateLabel(entry.entryDate)}</td><td className="px-3 py-3 text-xs text-slate-500">{entry.source.replaceAll('_', ' ')}</td><td className="max-w-[260px] truncate px-3 py-3 text-sm text-slate-200">{entry.description}</td><td className="px-1 py-3 text-right font-semibold text-slate-200">{money(Number(entry.totalDebit), currency)}</td><td className="px-1 py-3 text-right"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${entry.status === 'POSTED' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : entry.status === 'REVERSED' ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{entry.status}</span></td></tr>)}{!journals.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-600">No journal entries recorded.</td></tr>}</tbody></table></div></Panel><Panel title="Account movement" subtitle="Largest posted balances by absolute value"><div className="space-y-3">{accountRows.map(account => <div key={account.id} className="rounded-xl border border-white/[.08] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-sm text-slate-300"><span className="mr-2 font-mono text-[11px] text-cyan-300">{account.code}</span>{account.name}</span><strong className="shrink-0 text-sm text-white">{money(account.balance, currency)}</strong></div><div className="mt-1 flex justify-between text-[11px] text-slate-600"><span>{account.type}</span><span>{account.activity} lines</span></div></div>)}{!accountRows.length && <EmptyInline text="No posted account movement." />}</div><Link href="/accountant/statements" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-300">Open financial statements <ArrowRight className="h-3.5 w-3.5" /></Link></Panel></section>

    <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><Scale className="h-4 w-4" />Chart of accounts control</div><h2 className="mt-1 text-lg font-semibold text-white">Active account register</h2><p className="mt-1 text-xs text-slate-500">The live property chart used by automated postings and manual journals.</p></div><Link href="/accountant/settings" className="text-xs font-semibold text-violet-300">Manage accounting settings <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="py-3">Code</th><th className="py-3">Account</th><th className="py-3">Class</th><th className="py-3">Normal balance</th><th className="py-3 text-right">Posted balance</th><th className="py-3 text-right">Activity</th></tr></thead><tbody className="divide-y divide-white/[.06]">{accounts.slice(0, 12).map(account => { const row = accountRows.find(item => item.id === account.id); return <tr key={account.id}><td className="py-3 font-mono text-xs text-cyan-300">{account.code}</td><td className="py-3 text-slate-200">{account.name}</td><td className={`py-3 text-xs ${typeColors[account.type]}`}>{accountTypeLabels[account.type]}</td><td className="py-3 text-xs text-slate-500">{account.normalBalance}</td><td className="py-3 text-right text-slate-200">{money(row?.balance || 0, currency)}</td><td className="py-3 text-right text-xs text-slate-500">{row?.activity || 0}</td></tr> })}</tbody></table></div></section>

    <footer className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-xs text-slate-600 sm:flex-row"><span>Live source: posted journal lines, accounting periods, and the property chart of accounts.</span><span>As of {dateLabel(businessDate)}</span></footer>
  </div></main>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' }) { const colors = { emerald: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/15', amber: 'text-amber-300 bg-amber-400/10 ring-amber-400/15', rose: 'text-rose-300 bg-rose-400/10 ring-rose-400/15', cyan: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/15', violet: 'text-violet-300 bg-violet-400/10 ring-violet-400/15' }; return <div className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div></div>; }
function Panel({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) { return <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,.1)] sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{action}</div><div className="mt-5">{children}</div></section>; }
function EmptyInline({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-600">{text}</div>; }
function EmptyState({ title }: { title: string }) { return <main className="flex min-h-full items-center justify-center bg-[#08111f] text-slate-300"><div className="text-center"><BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-600" /><h1 className="text-xl font-semibold text-white">{title}</h1></div></main>; }

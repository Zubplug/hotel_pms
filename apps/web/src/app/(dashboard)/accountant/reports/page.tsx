import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  LockKeyhole,
  Printer,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const statusLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freports');

  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = session.user.propertyId && propertyIds.includes(session.user.propertyId) ? session.user.propertyId : propertyIds[0];
  if (!propertyId) return <EmptyState title="No property assigned" />;

  const [property, journals, postedLines, periods, remittances, payrollPeriods, auditLogs] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } }),
    prisma.journalEntry.findMany({ where: { propertyId }, select: { id: true, entryNumber: true, entryDate: true, source: true, description: true, status: true, totalDebit: true, totalCredit: true }, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }], take: 500 }),
    prisma.journalEntryLine.findMany({ where: { entry: { propertyId, status: 'POSTED' } }, select: { debit: true, credit: true } }),
    prisma.accountingPeriod.findMany({ where: { propertyId }, select: { id: true, name: true, periodStart: true, periodEnd: true, status: true }, orderBy: { periodStart: 'desc' }, take: 24 }),
    prisma.taxRemittance.findMany({ where: { propertyId }, select: { id: true, taxType: true, periodStart: true, periodEnd: true, remittedAmount: true, status: true, remittanceRef: true }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.payrollPeriod.findMany({ where: { propertyId }, select: { id: true, name: true, startDate: true, endDate: true, status: true, totalGross: true, journalEntryId: true }, orderBy: { startDate: 'desc' }, take: 100 }),
    prisma.auditLog.findMany({ where: { propertyId }, select: { id: true, action: true, resource: true, resourceId: true, userEmail: true, userRole: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const currency = property?.baseCurrency || 'NGN';
  const businessDate = property?.businessDate || new Date();
  const postedJournals = journals.filter(entry => entry.status === 'POSTED');
  const draftJournals = journals.filter(entry => entry.status === 'DRAFT');
  const totalDebit = postedLines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = postedLines.reduce((sum, line) => sum + Number(line.credit), 0);
  const difference = Number((totalDebit - totalCredit).toFixed(2));
  const openPeriods = periods.filter(period => period.status === 'OPEN');
  const currentPeriod = periods.find(period => period.periodStart <= businessDate && period.periodEnd >= businessDate);
  const pendingRemittances = remittances.filter(item => ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(item.status));
  const unpostedPayroll = payrollPeriods.filter(period => ['APPROVED', 'PAID'].includes(period.status) && !period.journalEntryId);
  const activePeriodLabel = currentPeriod ? `${currentPeriod.name} · ${statusLabel(currentPeriod.status)}` : 'No period covers business date';
  const printQuery = `propertyId=${encodeURIComponent(propertyId)}&businessDate=${encodeURIComponent(dateKey(businessDate))}`;
  const postingTrend = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(businessDate);
    day.setUTCDate(day.getUTCDate() - (13 - index));
    const key = dateKey(day);
    const dayEntries = postedJournals.filter(entry => dateKey(entry.entryDate) === key);
    return {
      label: new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(day),
      amount: dayEntries.reduce((sum, entry) => sum + Number(entry.totalDebit), 0),
      count: dayEntries.length,
    };
  });
  const maxPostingDay = Math.max(...postingTrend.map(day => day.amount), 1);
  const documentRows = [
    { name: 'Trial balance', type: 'General ledger', source: 'Posted journal lines', status: difference === 0 ? 'Balanced' : 'Review required', href: `/night-audit/reports/print/trial-balance?${printQuery}`, print: true },
    { name: "Manager's flash report", type: 'Daily operating report', source: 'Night audit and live operations', status: 'Available', href: `/night-audit/reports/print/managers-flash?${printQuery}`, print: true },
    { name: 'Journal register', type: 'General ledger', source: `${postedJournals.length} posted entries`, status: 'Live register', href: '/accountant/gl', print: false },
    { name: 'Tax remittance register', type: 'Statutory control', source: `${remittances.length} recorded remittances`, status: pendingRemittances.length ? `${pendingRemittances.length} require action` : 'Controlled', href: '/accountant/taxes', print: false },
    { name: 'Payroll liability register', type: 'Payroll control', source: `${payrollPeriods.length} payroll periods`, status: unpostedPayroll.length ? `${unpostedPayroll.length} not linked to GL` : 'Controlled', href: '/accountant/payroll', print: false },
    { name: 'Accounting period control', type: 'Close control', source: `${openPeriods.length} open periods`, status: activePeriodLabel, href: '/accountant/gl', print: false },
  ];
  const exportHref = (report: string, range: string) => `/api/v1/accountant/reports/export?propertyId=${encodeURIComponent(propertyId)}&report=${encodeURIComponent(report)}&range=${encodeURIComponent(range)}`;
  const ranges = [
    { key: 'week', label: 'Weekly' },
    { key: 'month', label: 'Monthly' },
    { key: 'quarter', label: 'Quarterly' },
    { key: 'half-year', label: 'Half-year' },
    { key: 'year', label: 'Yearly' },
  ];

  const healthChecks = [
    { label: 'Trial balance', detail: difference === 0 ? 'Posted debits and credits agree.' : `${money(Math.abs(difference), currency)} difference requires review.`, ok: difference === 0 },
    { label: 'Current accounting period', detail: currentPeriod ? activePeriodLabel : 'Open the correct period before posting.', ok: Boolean(currentPeriod?.status === 'OPEN') },
    { label: 'Payroll posting links', detail: unpostedPayroll.length ? `${unpostedPayroll.length} approved or paid period${unpostedPayroll.length === 1 ? '' : 's'} have no journal link.` : 'Approved and paid periods are linked to the GL.', ok: unpostedPayroll.length === 0 },
    { label: 'Tax filing queue', detail: pendingRemittances.length ? `${pendingRemittances.length} remittance record${pendingRemittances.length === 1 ? '' : 's'} remain in workflow.` : 'No tax remittances are awaiting workflow action.', ok: pendingRemittances.length === 0 },
  ];

  return <main className="min-h-full bg-[#08111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1540px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300"><FileText className="h-4 w-4" />Accounting reports</div><h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">The evidence behind every close.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Live registers and controlled print views for {property?.name || 'this property'}. Every count, status, and amount below is sourced from the property ledger and workflow records.</p></div><div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{dateLabel(businessDate)}</strong></div></header>

    <section className={`flex flex-col justify-between gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center ${healthChecks.filter(item => item.ok).length === healthChecks.length ? 'border-emerald-400/15 bg-emerald-400/[.055]' : 'border-amber-400/20 bg-amber-400/[.06]'}`}><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${healthChecks.filter(item => item.ok).length === healthChecks.length ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{healthChecks.filter(item => item.ok).length === healthChecks.length ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><p className="text-sm font-semibold text-white">Reporting close posture: {healthChecks.filter(item => item.ok).length}/{healthChecks.length} controls healthy</p><p className="mt-1 text-xs text-slate-400">{difference === 0 ? 'The posted ledger is balanced.' : 'The posted ledger is not balanced.'} Review exceptions before issuing controlled documentation.</p></div></div><Link href="/accountant/audit" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open audit controls <ArrowUpRight className="h-3.5 w-3.5" /></Link></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Posted journals" value={postedJournals.length.toLocaleString()} detail={`${journals.length.toLocaleString()} entries in register`} icon={BookOpen} tone="cyan" /><Metric label="Ledger proof" value={difference === 0 ? 'Balanced' : money(Math.abs(difference), currency)} detail={`${money(totalDebit, currency)} debits · ${money(totalCredit, currency)} credits`} icon={Scale} tone={difference === 0 ? 'emerald' : 'rose'} /><Metric label="Open periods" value={openPeriods.length.toLocaleString()} detail={activePeriodLabel} icon={LockKeyhole} tone={currentPeriod?.status === 'OPEN' ? 'emerald' : 'amber'} /><Metric label="Draft journals" value={draftJournals.length.toLocaleString()} detail="Awaiting controlled posting" icon={FileCheck2} tone={draftJournals.length ? 'amber' : 'emerald'} /><Metric label="Tax workflow" value={pendingRemittances.length.toLocaleString()} detail="Remittances not yet completed" icon={Landmark} tone={pendingRemittances.length ? 'amber' : 'emerald'} /><Metric label="Payroll links" value={unpostedPayroll.length.toLocaleString()} detail="Approved/paid periods without GL link" icon={Activity} tone={unpostedPayroll.length ? 'rose' : 'emerald'} /></section>

    <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[.045] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300"><FileText className="h-4 w-4" />Accounting report pack</div><h2 className="mt-1 text-lg font-semibold text-white">Download the complete evidence pack by period</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Each download contains live journal, trial-balance, tax, payroll, period, open-receivable, and audit sections for the selected range. The range ends on the property business date.</p></div><div className="flex flex-wrap gap-2">{ranges.map(range => <Link key={range.key} href={exportHref('pack', range.key)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/15">{range.label} pack</Link>)}</div></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.07] pt-4 text-[11px] text-slate-500">{[['journals', 'Journal register'], ['trial-balance', 'Trial balance'], ['tax', 'Tax remittances'], ['payroll', 'Payroll'], ['periods', 'Accounting periods'], ['receivables', 'Open receivables'], ['audit', 'Audit activity']].map(([report, label]) => <span key={report}><Link href={exportHref(report, 'month')} className="text-cyan-300 hover:text-cyan-200">Download {label}</Link> · monthly</span>)}</div></section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Journal production trend" subtitle="Posted debit value and journal volume over the last 14 business dates"><div className="flex h-52 items-end gap-1.5 sm:gap-2">{postingTrend.map(day => <div key={day.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-40 w-full items-end justify-center"><span title={`${day.label}: ${money(day.amount, currency)} · ${day.count} journals`} className="w-full rounded-t bg-cyan-400/75 transition group-hover:bg-cyan-300" style={{ height: `${day.amount ? Math.max(day.amount / maxPostingDay * 100, 3) : 0}%` }} /></div><span className="truncate text-[10px] text-slate-600">{day.label}</span></div>)}</div><div className="mt-4 flex items-center gap-5 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />Posted debit value</span><span className="ml-auto">{postingTrend.reduce((sum, day) => sum + day.count, 0)} journals in window</span></div></Panel><Panel title="Report design basis" subtitle="Controls reflected in the live document set"><div className="space-y-3"><Basis label="Trial-balance proof" detail="Debits, credits, and ledger balance status" /><Basis label="Journal traceability" detail="Posted entry register and source classification" /><Basis label="Subledger controls" detail="Tax and payroll workflow links to the GL" /><Basis label="Close evidence" detail="Property period and audit activity context" /></div></Panel></section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Document portfolio" subtitle="Live report definitions with a direct register or controlled print view"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="py-3">Document</th><th className="py-3">Type</th><th className="py-3">Live source</th><th className="py-3">Status</th><th className="py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.06]">{documentRows.map(row => <tr key={row.name} className="transition hover:bg-white/[.03]"><td className="py-3 font-medium text-slate-200">{row.name}</td><td className="py-3 text-xs text-slate-500">{row.type}</td><td className="py-3 text-xs text-slate-400">{row.source}</td><td className="py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${row.status.includes('Review') || row.status.includes('require') || row.status.includes('not linked') ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>{row.status}</span></td><td className="py-3 text-right">{row.print ? <Link href={row.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/15"><Printer className="h-3.5 w-3.5" />Print / save PDF</Link> : <Link href={row.href} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open live register <ArrowUpRight className="h-3.5 w-3.5" /></Link>}</td></tr>)}</tbody></table></div><p className="mt-4 text-[11px] leading-5 text-slate-600">Print views use the browser’s print dialog, where accounting staff can send the controlled document to a printer or save it as PDF. No report file is fabricated in the browser.</p></Panel><Panel title="Reporting insights" subtitle="Signals calculated from current property records"><div className="space-y-3"><Insight label="Posted ledger volume" value={money(totalDebit, currency)} detail={`${postedJournals.length} posted journal${postedJournals.length === 1 ? '' : 's'} currently support reporting.`} icon={ClipboardCheck} /><Insight label="Tax exposure" value={pendingRemittances.length.toLocaleString()} detail="Remittance records still in draft, submitted, or approved workflow." icon={Landmark} /><Insight label="Payroll integrity" value={unpostedPayroll.length ? 'Review' : 'Linked'} detail={unpostedPayroll.length ? 'Some approved or paid payroll periods are not linked to a journal.' : 'Approved and paid payroll periods have journal links.'} icon={Activity} /></div></Panel></section>

    <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><Panel title="Control checks" subtitle="The conditions that affect whether reports are ready for issue"><div className="space-y-3">{healthChecks.map(check => <div key={check.label} className="flex items-start gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${check.ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{check.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div><div className="text-xs font-semibold text-slate-200">{check.label}</div><div className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</div></div></div>)}</div></Panel><Panel title="Recent accounting activity" subtitle="Actual audit events recorded for this property"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="py-3">Event</th><th className="py-3">Resource</th><th className="py-3">Actor</th><th className="py-3 text-right">When</th></tr></thead><tbody className="divide-y divide-white/[.06]">{auditLogs.map(log => <tr key={log.id}><td className="py-3"><p className="text-sm text-slate-200">{statusLabel(log.action)}</p><p className="mt-1 font-mono text-[10px] text-slate-600">{log.resourceId}</p></td><td className="py-3 text-xs text-slate-400">{statusLabel(log.resource)}</td><td className="py-3 text-xs text-slate-400">{log.userEmail || log.userRole || 'System'}</td><td className="py-3 text-right text-xs text-slate-500">{dateLabel(log.createdAt)}</td></tr>)}{!auditLogs.length && <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-600">No audit activity has been recorded for this property.</td></tr>}</tbody></table></div></Panel></section>

    <footer className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-xs text-slate-600 sm:flex-row"><span>Live source: journal register, posted ledger lines, accounting periods, tax remittances, payroll periods, and audit logs.</span><span>As of {dateLabel(businessDate)}</span></footer>
  </div></main>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: 'emerald' | 'amber' | 'rose' | 'cyan' }) { const colors = { emerald: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/15', amber: 'text-amber-300 bg-amber-400/10 ring-amber-400/15', rose: 'text-rose-300 bg-rose-400/10 ring-rose-400/15', cyan: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/15' }; return <div className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div></div>; }
function Insight({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ElementType }) { return <div className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{label}</span><strong className="text-sm text-white">{value}</strong></div><p className="mt-1 text-[11px] leading-4 text-slate-600">{detail}</p></div></div>; }
function Basis({ label, detail }: { label: string; detail: string }) { return <div className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.55)]" /><div><p className="text-xs font-semibold text-slate-200">{label}</p><p className="mt-1 text-[11px] leading-4 text-slate-600">{detail}</p></div></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,.1)] sm:p-6"><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function EmptyState({ title }: { title: string }) { return <main className="flex min-h-full items-center justify-center bg-[#08111f] text-slate-300"><div className="text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-600" /><h1 className="text-xl font-semibold text-white">{title}</h1></div></main>; }

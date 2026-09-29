'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, CircleDollarSign, FileText, Landmark, Loader2, RefreshCcw, Scale, ShieldCheck, WalletCards } from 'lucide-react';

type Domain = 'receivables' | 'city-ledger' | 'payables' | 'taxes' | 'gl';
type Tone = 'emerald' | 'blue' | 'amber' | 'rose' | 'violet';
type Json = any;

const config: Record<Domain, { title: string; eyebrow: string; description: string; icon: ElementType; link: string }> = {
  receivables: { title: 'Receivables control centre', eyebrow: 'Accounting Management / Receivables', description: 'Executive visibility into guest balances, collection pressure, aging, and unsettled folios.', icon: WalletCards, link: '/general-manager/accounting/reports' },
  'city-ledger': { title: 'City ledger control centre', eyebrow: 'Accounting Management / City Ledger', description: 'Corporate exposure, credit utilization, invoice aging, and collection risk across the property.', icon: Landmark, link: '/general-manager/accounting/reports' },
  payables: { title: 'Payables control centre', eyebrow: 'Accounting Management / Payables', description: 'Supplier obligations, due-date pressure, review queues, and payment readiness for management.', icon: FileText, link: '/general-manager/accounting/reports' },
  taxes: { title: 'Tax position control centre', eyebrow: 'Accounting Management / Tax Position', description: 'Tax collected, remittance posture, statutory exposure, and filing exceptions before close.', icon: Scale, link: '/general-manager/accounting/reports' },
  gl: { title: 'General ledger control centre', eyebrow: 'Accounting Management / GL Integrity', description: 'Chart-of-accounts coverage, posting activity, close confidence, and trial-balance control signals.', icon: BarChart3, link: '/general-manager/night-audit/reconciliation' },
};

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
const number = (value: unknown) => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value: unknown) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(String(value))) : '—';
const unwrap = (body: Json) => body?.data ?? body;

export default function GeneralManagerAccountingDomain({ domain }: { domain: Domain }) {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const { status: sessionStatus } = useLodgeCoreSession();
  const [data, setData] = useState<Json>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = config[domain];
  const HeaderIcon = current.icon;

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const urls: Record<Domain, string> = {
        receivables: `/api/v1/reports/receivables?propertyId=${encodeURIComponent(propertyId)}`,
        'city-ledger': `/api/v1/corporate-accounts/analytics?propertyId=${encodeURIComponent(propertyId)}`,
        payables: `/api/v1/accountant/payables?propertyId=${encodeURIComponent(propertyId)}`,
        taxes: `/api/v1/accountant/taxes?propertyId=${encodeURIComponent(propertyId)}`,
        gl: `/api/v1/accountant/gl/accounts?propertyId=${encodeURIComponent(propertyId)}`,
      };
      const [analyticsResponse, domainResponse] = await Promise.all([
        fetch(`/api/v1/general-manager/accounting/command-center?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' }),
        fetch(urls[domain], { cache: 'no-store' }),
      ]);
      const analyticsBody = await analyticsResponse.json();
      const domainBody = await domainResponse.json();
      if (!analyticsResponse.ok) throw new Error(analyticsBody.error?.message || analyticsBody.error || 'Unable to load management accounting data');
      setData({ analytics: unwrap(analyticsBody), detail: domainResponse.ok ? unwrap(domainBody) : null, detailError: domainResponse.ok ? null : (domainBody.error?.message || domainBody.error || 'The supporting register is unavailable.') });
    } catch (cause: any) { setError(cause.message || 'Unable to load management accounting data'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus, domain]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || 'Management accounting data is unavailable.'} onRetry={() => load()} />;

  const analytics = data.analytics || {};
  const management = analytics.management || {};
  const detail = data.detail;
  const flags = analytics.flags || {};
  const totalFlags = Object.values(flags).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const reviewCount = domain === 'gl' ? Number(flags.glExceptions || 0) : domain === 'taxes' ? Number(flags.taxExceptions || 0) : domain === 'payables' ? Number(flags.overdueInvoices || 0) + Number(flags.pendingExpenses || 0) : Number(flags.overdueReceivables || 0) + Number(flags.openExceptions || 0);
  const businessDate = date(analytics.businessDate);
  const domainCards = buildDomainCards(domain, detail, analytics, flags);

  return <main className="min-h-full bg-[linear-gradient(160deg,#060c18_0%,#080e1f_68%,#0a0c22_100%)] px-4 pb-16 pt-6 text-slate-200 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-400"><HeaderIcon className="h-3.5 w-3.5" /> {current.eyebrow}</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{current.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{current.description} This management view is read-only; operational posting stays with the accountant workspace.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{businessDate}</strong></span><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></div></header>
    <section className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center ${reviewCount ? 'border-amber-400/20 bg-amber-400/[.06]' : 'border-emerald-400/20 bg-emerald-400/[.06]'}`}><div className="flex items-start gap-3">{reviewCount ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />}<div><p className="text-sm font-semibold text-white">{reviewCount ? `${reviewCount} item${reviewCount === 1 ? '' : 's'} require management review` : 'Control posture is clear'}</p><p className="mt-1 text-xs text-slate-500">Last night audit: {analytics.audit?.lastAuditStatus || 'PENDING'} · Read-only evidence view for the assigned property.</p></div></div><a href={current.link} className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Open supporting evidence <ArrowUpRight className="h-3.5 w-3.5" /></a></section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{domainCards.map((card) => <Metric key={card.label} {...card} />)}</div>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Evidence label="Net operating result" value={money(management.statements?.profitAndLoss?.summary?.balance)} detail="Current business month" tone="emerald" /><Evidence label="Balance sheet check" value={money(management.statements?.balanceSheet?.summary?.balance)} detail="Assets less liabilities and equity" tone={Math.abs(Number(management.statements?.balanceSheet?.summary?.balance || 0)) < .01 ? 'emerald' : 'rose'} /><Evidence label="GL control variance" value={money(management.controls?.gl?.variance)} detail={management.controls?.gl?.status || 'Subledger proof'} tone={Math.abs(Number(management.controls?.gl?.variance || 0)) < .01 ? 'emerald' : 'rose'} /><Evidence label="Accounting period" value={management.close?.currentPeriod?.name || 'Not configured'} detail={management.close?.currentPeriod?.status || 'No period status'} tone="violet" /></section>
    <DomainView domain={domain} detail={detail} analytics={analytics} detailError={data.detailError} />
  </div></main>;
}

function DomainView({ domain, detail, analytics, detailError }: { domain: Domain; detail: Json; analytics: Json; detailError: string | null }) {
  if (domain === 'receivables') return <Receivables detail={detail} analytics={analytics} detailError={detailError} />;
  if (domain === 'city-ledger') return <CityLedger detail={detail} detailError={detailError} />;
  if (domain === 'payables') return <Payables detail={detail} analytics={analytics} detailError={detailError} />;
  if (domain === 'taxes') return <Taxes detail={detail} analytics={analytics} detailError={detailError} />;
  return <GeneralLedger detail={detail} analytics={analytics} detailError={detailError} />;
}

function buildDomainCards(domain: Domain, detail: Json, analytics: Json, flags: Json) {
  if (domain === 'receivables') {
    const rows = detail?.receivables || [];
    const outstanding = rows.reduce((sum: number, row: Json) => sum + Number(row.financials?.balance || 0), 0);
    const overdue = rows.filter((row: Json) => row.aging?.status === 'OVERDUE');
    const overdueAmount = overdue.reduce((sum: number, row: Json) => sum + Number(row.financials?.balance || 0), 0);
    const checkedOutAmount = rows.filter((row: Json) => row.aging?.status === 'CHECKED_OUT').reduce((sum: number, row: Json) => sum + Number(row.financials?.balance || 0), 0);
    const avgDays = rows.length ? Math.round(rows.reduce((sum: number, row: Json) => sum + Number(row.aging?.daysOutstanding || 0), 0) / rows.length) : 0;
    return [
      { label: 'Overdue share', value: outstanding ? `${Math.round((overdueAmount / outstanding) * 100)}%` : '0%', detail: `${number(overdue.length)} folios past due`, icon: AlertTriangle, tone: overdueAmount ? 'rose' as Tone : 'emerald' as Tone },
      { label: 'Checked-out exposure', value: money(checkedOutAmount), detail: 'Debt after departure', icon: ShieldCheck, tone: checkedOutAmount ? 'amber' as Tone : 'emerald' as Tone },
      { label: 'Average age', value: `${number(avgDays)} days`, detail: 'Across unsettled guest balances', icon: BarChart3, tone: avgDays > 30 ? 'rose' as Tone : 'blue' as Tone },
      { label: 'Collection focus', value: overdue.length ? 'Required' : 'Stable', detail: 'Management collection posture', icon: WalletCards, tone: overdue.length ? 'amber' as Tone : 'emerald' as Tone },
    ];
  }
  if (domain === 'city-ledger') {
    const overview = detail?.overview || {};
    const topAccount = detail?.topAccounts?.[0];
    const activeAccounts = detail?.accounts?.filter((account: Json) => account.isActive) || [];
    const utilization = activeAccounts.filter((account: Json) => account.utilization !== null);
    const averageUtilization = utilization.length ? Math.round(utilization.reduce((sum: number, account: Json) => sum + Number(account.utilization || 0), 0) / utilization.length) : 0;
    return [
      { label: 'Portfolio utilization', value: `${averageUtilization}%`, detail: 'Average active-account credit use', icon: Scale, tone: averageUtilization >= 80 ? 'amber' as Tone : 'blue' as Tone },
      { label: 'Largest exposure', value: money(topAccount?.receivable), detail: topAccount?.name || 'No concentration recorded', icon: Landmark, tone: 'amber' as Tone },
      { label: 'Advance credits', value: money(overview.advanceCredit), detail: 'Available customer credit', icon: CircleDollarSign, tone: 'emerald' as Tone },
      { label: 'Collection risk', value: overview.overdue ? 'Review' : 'Stable', detail: money(overview.overdue) + ' past due', icon: AlertTriangle, tone: overview.overdue ? 'rose' as Tone : 'emerald' as Tone },
    ];
  }
  if (domain === 'payables') {
    const rows = (Array.isArray(detail) ? detail : detail?.data || []).filter((row: Json) => !['PAID', 'CANCELLED'].includes(row.status) && Number(row.outstandingAmount || 0) > 0);
    const dueSoon = rows.filter((row: Json) => { const daysUntilDue = row.dueDate ? Math.ceil((new Date(row.dueDate).getTime() - Date.now()) / 86400000) : 999; return Number(row.daysOverdue || 0) <= 0 && daysUntilDue >= 0 && daysUntilDue <= 7; });
    const supplierCount = new Set(rows.map((row: Json) => row.supplierId || row.supplier?.id)).size;
    const purchaseOrderLinked = rows.filter((row: Json) => row.purchaseOrderId || row.purchaseOrder).length;
    return [
      { label: '7-day cash need', value: money(dueSoon.reduce((sum: number, row: Json) => sum + Number(row.outstandingAmount || 0), 0)), detail: `${number(dueSoon.length)} invoices due soon`, icon: CircleDollarSign, tone: dueSoon.length ? 'amber' as Tone : 'emerald' as Tone },
      { label: 'Supplier breadth', value: number(supplierCount), detail: 'Suppliers with open obligations', icon: Landmark, tone: 'blue' as Tone },
      { label: 'PO-linked invoices', value: `${rows.length ? Math.round((purchaseOrderLinked / rows.length) * 100) : 0}%`, detail: 'Purchase-order coverage', icon: ShieldCheck, tone: 'violet' as Tone },
      { label: 'Payment readiness', value: rows.some((row: Json) => ['RECEIVED', 'UNDER_REVIEW'].includes(row.status)) ? 'Review' : 'Ready', detail: 'Approval queue posture', icon: AlertTriangle, tone: rows.some((row: Json) => ['RECEIVED', 'UNDER_REVIEW'].includes(row.status)) ? 'amber' as Tone : 'emerald' as Tone },
    ];
  }
  if (domain === 'taxes') {
    const rows = (Array.isArray(detail) ? detail : detail?.data || []);
    const collected = rows.reduce((sum: number, row: Json) => sum + Number(row.collectedAmount || 0), 0);
    const remitted = rows.reduce((sum: number, row: Json) => sum + Number(row.remittedAmount || 0), 0);
    const authorities = new Set(rows.map((row: Json) => row.authorityName).filter(Boolean)).size;
    return [
      { label: 'Remittance coverage', value: collected ? `${Math.round((remitted / collected) * 100)}%` : '0%', detail: `${money(remitted)} remitted of ${money(collected)}`, icon: CheckCircle2, tone: remitted >= collected && collected > 0 ? 'emerald' as Tone : 'amber' as Tone },
      { label: 'Pending filings', value: number(rows.filter((row: Json) => row.status === 'SUBMITTED').length), detail: 'Submitted and awaiting settlement', icon: FileText, tone: 'blue' as Tone },
      { label: 'Rejected filings', value: number(rows.filter((row: Json) => row.status === 'REJECTED').length), detail: 'Correction required', icon: AlertTriangle, tone: rows.some((row: Json) => row.status === 'REJECTED') ? 'rose' as Tone : 'emerald' as Tone },
      { label: 'Authorities', value: number(authorities), detail: 'Statutory bodies represented', icon: Landmark, tone: 'violet' as Tone },
    ];
  }
  const accounts = (Array.isArray(detail) ? detail : detail?.data || []);
  const trialBalanceVariance = Number(analytics.management?.statements?.trialBalance?.summary?.debit || 0) - Number(analytics.management?.statements?.trialBalance?.summary?.credit || 0);
    return [
    { label: 'Trial-balance variance', value: money(trialBalanceVariance), detail: 'Debit less credit', icon: Scale, tone: Math.abs(trialBalanceVariance) < .01 ? 'emerald' as Tone : 'rose' as Tone },
    { label: 'Draft journals', value: number(analytics.management?.controls?.journals?.drafts), detail: 'Entries awaiting posting', icon: FileText, tone: analytics.management?.controls?.journals?.drafts ? 'amber' as Tone : 'emerald' as Tone },
    { label: 'Account coverage', value: number(accounts.filter((account: Json) => account.isActive).length), detail: `${number(new Set(accounts.map((account: Json) => account.type)).size)} account classes`, icon: BarChart3, tone: 'blue' as Tone },
    { label: 'Audit state', value: analytics.audit?.lastAuditStatus || 'PENDING', detail: 'Latest night-audit status', icon: ShieldCheck, tone: analytics.audit?.lastAuditStatus === 'COMPLETED' ? 'emerald' as Tone : 'amber' as Tone },
  ];
}

function Receivables({ detail, analytics, detailError }: { detail: Json; analytics: Json; detailError: string | null }) {
  const rows = detail?.receivables || [];
  const buckets = useMemo(() => rows.reduce((acc: Record<string, number>, row: Json) => { const key = row.aging?.status === 'OVERDUE' ? (Number(row.aging.daysOutstanding) > 30 ? '31+ days' : '1–30 days') : 'Current'; acc[key] = (acc[key] || 0) + Number(row.financials?.balance || 0); return acc; }, {}), [rows]);
  return <><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Guest ledger exposure" subtitle="Unsettled folios returned by the live receivables report"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Open folios" value={number(rows.length)} /><Mini label="Outstanding" value={money(rows.reduce((s: number, r: Json) => s + Number(r.financials?.balance || 0), 0))} /><Mini label="Overdue folios" value={number(rows.filter((r: Json) => r.aging?.status === 'OVERDUE').length)} tone="amber" /><Mini label="Checked out debt" value={number(rows.filter((r: Json) => r.aging?.status === 'CHECKED_OUT').length)} tone="rose" /></div><div className="mt-6"><Aging values={buckets} /></div></Panel><Panel title="Collection interpretation" subtitle="Signals management should act on"><Insight title="Recovery pressure" value={`${number(rows.filter((r: Json) => r.aging?.status === 'OVERDUE').length)} folios overdue`} detail="Prioritise checked-out guests and balances beyond 30 days." tone="amber" /><Insight title="Last audit reference" value={analytics.audit?.lastAuditStatus || 'PENDING'} detail={`Latest audit date: ${date(analytics.audit?.lastAuditDate)}`} tone="blue" /></Panel></div><Register title="Receivables focus register" subtitle="Highest-risk unsettled folios" error={detailError} headers={['Guest / folio', 'Stay', 'Age', 'Balance']} rows={rows.slice(0, 10).map((row: Json) => [<span key="g"><strong className="block text-slate-200">{row.guest?.name || 'Unassigned guest'}</strong><span className="text-[11px] text-slate-500">{row.folioNumber || row.folioId}</span></span>, row.reservation?.room ? `Room ${row.reservation.room}` : 'Master folio', row.aging?.status === 'OVERDUE' ? `${number(row.aging.daysOutstanding)} days` : row.aging?.status || 'Current', money(row.financials?.balance)])} /></>;
}

function CityLedger({ detail, detailError }: { detail: Json; detailError: string | null }) {
  const overview = detail?.overview || {}; const accounts = detail?.accounts || []; const aging = Object.fromEntries((detail?.aging || []).map((item: Json) => [item.bucket, Number(item.amount || 0)]));
  return <><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="City ledger exposure" subtitle="Corporate receivables, walk-outs, and guest refund liabilities"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Active accounts" value={number(overview.activeAccounts)} /><Mini label="Corporate AR" value={money(Number(overview.outstanding || 0) - Number(overview.skipperOutstanding || 0))} tone="rose" /><Mini label="Walk-out exposure" value={money(overview.skipperOutstanding)} tone="rose" /><Mini label="Refund liability" value={money(overview.refundPayable)} tone="blue" /></div><div className="mt-6"><Aging bars values={aging} /></div></Panel><Panel title="Portfolio concentration" subtitle="Largest live receivable balances"><div className="space-y-4">{(detail?.topAccounts || []).slice(0, 5).map((account: Json, index: number) => <BarRow key={account.id || index} label={account.name} value={money(account.receivable)} percent={Number(account.receivable || 0) / Math.max(Number(detail?.topAccounts?.[0]?.receivable || 1), 1) * 100} tone={Number(account.receivable || 0) > 0 ? "text-rose-300" : "text-white"} />)}{!detail?.topAccounts?.length && <Empty text="No city ledger exposure recorded." />}</div></Panel></div><Register title="City ledger account register" subtitle="Corporate credit, walk-out exposure, advances, and refund liabilities" error={detailError} headers={['Account', 'Type', 'Credit limit', 'Receivable', 'Advance / liability']} rows={accounts.slice(0, 12).map((account: Json) => [<span key="a"><strong className="block text-slate-200">{account.name}</strong><span className="text-[11px] text-slate-500">{account.code || 'No account code'}</span></span>, <span className="text-[11px] uppercase tracking-wide text-slate-400">{String(account.type || 'CORPORATE').replace('_', ' ')}</span>, money(account.creditLimit), <span key="b" className={Number(account.receivable || 0) > 0 ? 'text-rose-300' : account.utilization >= 80 ? 'text-amber-300' : 'text-slate-200'}>{money(account.receivable)}{account.utilization !== null ? <span className="ml-2 text-[11px] text-slate-500">{account.utilization}% used</span> : null}</span>, account.type === 'REFUND_PAYABLE' ? <span className="text-amber-300">{money(account.liability)}<span className="ml-2 text-[11px] text-slate-500">refund liability</span></span> : Number(account.advanceCredit || 0) > 0 ? <span className="text-emerald-300">{money(account.advanceCredit)}<span className="ml-2 text-[11px] text-slate-500">advance</span></span> : <span className="text-slate-600">—</span>])} />{(detail?.pendingRefunds || []).length > 0 ? <Register title="Pending guest refund approvals" subtitle="Live refund requests currently carried by the city ledger" error={detailError} headers={['Request', 'Ledger account', 'Amount', 'Status']} rows={(detail?.pendingRefunds || []).map((refund: Json) => [<span className="font-mono text-xs text-slate-300">{String(refund.id).slice(0, 12)}</span>, refund.accountName || refund.accountId || 'Unassigned refund', money(refund.amount), <span className="text-amber-300">{String(refund.status).replace('_', ' ')}</span>])} /> : null}{(detail?.guestCredits || []).length > 0 ? <Register title="Open guest credits" subtitle="Guest-credit balances awaiting refund or approved application" error={detailError} headers={['Entry', 'Guest', 'Ledger account', 'Amount', 'Created']} rows={(detail?.guestCredits || []).map((credit: Json) => [<span className="font-mono text-xs text-slate-300">{String(credit.id).slice(0, 12)}</span>, <span><strong className="block text-slate-200">{credit.guestName || 'Unassigned guest'}</strong>{credit.guestEmail || credit.guestPhone ? <span className="text-[11px] text-slate-500">{credit.guestEmail || credit.guestPhone}</span> : null}</span>, credit.accountName || credit.accountId, money(credit.amount), date(credit.createdAt)])} /> : null}</>;
}

function Payables({ detail, analytics, detailError }: { detail: Json; analytics: Json; detailError: string | null }) {
  const invoices = Array.isArray(detail) ? detail : detail?.data || []; const open = invoices.filter((i: Json) => !['PAID', 'CANCELLED'].includes(i.status) && Number(i.outstandingAmount || 0) > 0); const buckets = open.reduce((acc: Record<string, number>, i: Json) => { const key = i.agingBucket === 'current' ? 'Current' : i.agingBucket === 'd90plus' ? '90+ days' : i.agingBucket?.replace('d', '')?.replace('_', '–') || 'Due'; acc[key] = (acc[key] || 0) + Number(i.outstandingAmount || 0); return acc; }, {});
  return <><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Supplier liability posture" subtitle="Live supplier invoice register"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Open invoices" value={number(open.length)} /><Mini label="Outstanding" value={money(open.reduce((s: number, i: Json) => s + Number(i.outstandingAmount || 0), 0))} /><Mini label="Overdue" value={number(open.filter((i: Json) => Number(i.daysOverdue || 0) > 0).length)} tone="amber" /><Mini label="Pending review" value={number(open.filter((i: Json) => ['RECEIVED', 'UNDER_REVIEW'].includes(i.status)).length)} tone="rose" /></div><div className="mt-6"><Aging bars values={buckets} /></div></Panel><Panel title="Cash requirement" subtitle="Management view of upcoming obligations"><Insight title="AP exposure" value={money(analytics.balances?.apOutstanding)} detail="Balance from the financial control snapshot." tone="amber" /><Insight title="Payment discipline" value={`${number(analytics.flags?.overdueInvoices)} overdue invoices`} detail="Use approved invoice and bank controls before release." tone="blue" /></Panel></div><Register title="Supplier invoice register" subtitle="Invoices requiring visibility or follow-up" error={detailError} headers={['Invoice / supplier', 'Due date', 'Status', 'Outstanding']} rows={open.slice(0, 12).map((i: Json) => [<span key="i"><strong className="block text-slate-200">{i.invoiceNumber}</strong><span className="text-[11px] text-slate-500">{i.supplier?.name || 'Supplier'}</span></span>, date(i.dueDate), i.status, money(i.outstandingAmount)])} /></>;
}

function Taxes({ detail, analytics, detailError }: { detail: Json; analytics: Json; detailError: string | null }) {
  const rows = Array.isArray(detail) ? detail : detail?.data || []; const submitted = rows.filter((r: Json) => r.status === 'SUBMITTED'); const remitted = rows.filter((r: Json) => r.status === 'REMITTED'); const rejected = rows.filter((r: Json) => r.status === 'REJECTED'); const collected = rows.reduce((s: number, r: Json) => s + Number(r.collectedAmount || 0), 0); const remittedAmount = rows.reduce((s: number, r: Json) => s + Number(r.remittedAmount || 0), 0);
  return <><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Statutory position" subtitle="Recorded tax remittances and current liability"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Tax liability" value={money(analytics.balances?.taxLiability?.total)} tone="amber" /><Mini label="Collected" value={money(collected)} /><Mini label="Remitted" value={money(remittedAmount)} tone="emerald" /><Mini label="Needs review" value={number(submitted.length + rejected.length)} tone="rose" /></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Insight title="Submitted" value={number(submitted.length)} detail="Awaiting final remittance control" tone="blue" /><Insight title="Remitted" value={number(remitted.length)} detail="Recorded as settled" tone="emerald" /><Insight title="Rejected" value={number(rejected.length)} detail="Requires correction or evidence" tone="rose" /></div></Panel><Panel title="Close interpretation" subtitle="Tax control signals for management"><Insight title="Audit dependency" value={analytics.audit?.lastAuditStatus || 'PENDING'} detail={`Last audit: ${date(analytics.audit?.lastAuditDate)}`} tone="blue" /><Insight title="Exception posture" value={analytics.flags?.taxExceptions ? `${number(analytics.flags.taxExceptions)} exceptions` : 'No flagged exceptions'} detail="Read-only signal from the accounting control snapshot." tone={analytics.flags?.taxExceptions ? 'amber' : 'emerald'} /></Panel></div><Register title="Tax remittance register" subtitle="Statutory periods and remittance status" error={detailError} headers={['Tax type / period', 'Collected', 'Remitted', 'Status']} rows={rows.slice(0, 12).map((r: Json) => [<span key="t"><strong className="block text-slate-200">{r.taxType || r.tax?.name || 'Tax remittance'}</strong><span className="text-[11px] text-slate-500">{date(r.periodStart)} – {date(r.periodEnd)}</span></span>, money(r.collectedAmount), money(r.remittedAmount), r.status])} /></>;
}

function GeneralLedger({ detail, analytics, detailError }: { detail: Json; analytics: Json; detailError: string | null }) {
  const accounts = Array.isArray(detail) ? detail : detail?.data || []; const active = accounts.filter((a: Json) => a.isActive); const byType = accounts.reduce((acc: Record<string, number>, a: Json) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
  return <><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Ledger integrity" subtitle="Chart-of-accounts coverage and posting confidence"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Active accounts" value={number(active.length)} /><Mini label="Account classes" value={number(Object.keys(byType).length)} /><Mini label="GL exceptions" value={number(analytics.flags?.glExceptions)} tone="amber" /><Mini label="Audit state" value={analytics.audit?.lastAuditStatus || 'PENDING'} tone="blue" /></div><div className="mt-6 grid gap-2 sm:grid-cols-5">{Object.entries(byType).map(([type, count]) => <div key={type} className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">{type}</p><p className="mt-2 text-lg font-semibold text-white">{number(count)}</p></div>)}</div></Panel><Panel title="Close confidence" subtitle="Management checks before sign-off"><Insight title="Night audit" value={analytics.audit?.lastAuditStatus || 'PENDING'} detail={`Last completed date: ${date(analytics.audit?.lastAuditDate)}`} tone="blue" /><Insight title="Exception queue" value={analytics.flags?.glExceptions ? `${number(analytics.flags.glExceptions)} GL items` : 'Clear'} detail="Investigate before financial close if non-zero." tone={analytics.flags?.glExceptions ? 'amber' : 'emerald'} /></Panel></div><Register title="Chart of accounts" subtitle="Live account master for the assigned property" error={detailError} headers={['Code / account', 'Type', 'Normal balance', 'Status']} rows={accounts.slice(0, 18).map((a: Json) => [<span key="c"><strong className="block text-slate-200">{a.code}</strong><span className="text-[11px] text-slate-500">{a.name}</span></span>, a.type, a.normalBalance, a.isActive ? 'ACTIVE' : 'INACTIVE'])} /></>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: ElementType; tone: Tone }) { const colors: Record<Tone, string> = { emerald: 'border-emerald-400/20 bg-emerald-400/[.07]', blue: 'border-blue-400/20 bg-blue-400/[.07]', amber: 'border-amber-400/20 bg-amber-400/[.07]', rose: 'border-rose-400/20 bg-rose-400/[.07]', violet: 'border-violet-400/20 bg-violet-400/[.07]' }; return <div className={`rounded-2xl border p-4 ${colors[tone]}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>; }
function Evidence({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'emerald' | 'rose' | 'violet' }) { const colors = { emerald: 'text-emerald-300', rose: 'text-rose-300', violet: 'text-violet-300' }; return <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-2 truncate text-lg font-bold ${colors[tone]}`}>{value}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <section className="rounded-[24px] border border-white/[.07] bg-white/[.025] p-5 sm:p-6"><div><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className="mt-5">{children}</div></section>; }
function Mini({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'amber' | 'rose' | 'blue' | 'emerald' }) { const color = tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : tone === 'blue' ? 'text-blue-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-white'; return <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-2 text-lg font-semibold ${color}`}>{value}</p></div>; }
function Insight({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: Tone }) { const color = tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : tone === 'emerald' ? 'text-emerald-300' : tone === 'blue' ? 'text-blue-300' : 'text-violet-300'; return <div className="mb-3 rounded-xl border border-white/[.06] bg-white/[.025] p-4 last:mb-0"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{title}</span><span className={`text-sm font-semibold ${color}`}>{value}</span></div><p className="mt-2 text-[11px] leading-relaxed text-slate-600">{detail}</p></div>; }
function Aging({ values }: { values: Record<string, number>; bars?: boolean }) { const max = Math.max(...Object.values(values), 1); return <div className="space-y-3">{Object.entries(values).map(([label, value]) => <div key={label}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-slate-400">{label}</span><strong className="text-slate-200">{money(value)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400" style={{ width: `${Math.max(value ? 4 : 0, value / max * 100)}%` }} /></div></div>)}</div>; }
function BarRow({ label, value, percent, tone = 'text-white' }: { label: string; value: string; percent: number; tone?: string }) { return <div><div className="mb-2 flex justify-between gap-3 text-sm"><span className="truncate text-slate-300">{label}</span><strong className={tone}>{value}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} /></div></div>; }
function Register({ title, subtitle, headers, rows, error }: { title: string; subtitle: string; headers: string[]; rows: ReactNode[][]; error: string | null }) { return <Panel title={title} subtitle={subtitle}><div className="overflow-x-auto">{error ? <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-3 text-xs text-amber-200">{error} Management summary remains available; the supporting register could not be loaded.</div> : null}<table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.14em] text-slate-500">{headers.map(header => <th key={header} className="pb-3 pr-4 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-white/[.05]">{rows.map((row, index) => <tr key={index} className="hover:bg-white/[.02]">{row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 pr-4 text-slate-300">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && !error ? <Empty text="No records are currently available for this property." /> : null}</div></Panel>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-slate-600">{text}</div>; }
function Loading() { return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-2xl rounded-2xl border border-rose-400/20 bg-rose-400/[.06] p-5 text-sm text-rose-300"><p>{message}</p><button onClick={onRetry} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200">Try again</button></div></div>; }

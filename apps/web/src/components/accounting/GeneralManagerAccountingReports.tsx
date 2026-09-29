'use client';

import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign, Download, FileText, Loader2, RefreshCcw, Scale, ShieldCheck, WalletCards } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function GeneralManagerAccountingReports() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const { status: sessionStatus } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('month');
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/general-manager/accounting/command-center?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load accounting reports');
      setData(body);
    } catch (cause: any) { setError(cause.message || 'Unable to load accounting reports'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (sessionStatus === 'authenticated' && !propertyLoading) void load(); }, [propertyId, propertyLoading, sessionStatus]);

  if (sessionStatus === 'loading' || propertyLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#060c18]"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  if (error || !data) return <div className="min-h-[70vh] bg-[#060c18] p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-300">{error || 'Accounting report data is unavailable.'}</div></div>;

  const revenue = data.revenue?.today || {};
  const balances = data.balances || {};
  const flags = data.flags || {};
  const tax = balances.taxLiability?.total || 0;
  const reportDate = data.businessDate ? new Date(data.businessDate).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : 'Current business date';
  const totalIssues = Object.values(flags).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const management = data.management || {};
  const statement = management.statements || {};
  const journalControls = management.controls?.journals || {};
  const currentPeriod = management.close?.currentPeriod;
  const summaryCards: Array<{ label: string; value: string; detail: string; icon: ElementType; tone: 'emerald' | 'blue' | 'amber' | 'rose' }> = [
    { label: 'Net profit / loss', value: money(statement.profitAndLoss?.summary?.balance), detail: 'Current reporting period', icon: CircleDollarSign, tone: 'emerald' },
    { label: 'Trial balance', value: money(Number(statement.trialBalance?.summary?.debit || 0) - Number(statement.trialBalance?.summary?.credit || 0)), detail: 'Debit less credit control', icon: Scale, tone: 'blue' },
    { label: 'GL variance', value: money(management.controls?.gl?.variance), detail: management.controls?.gl?.status || 'Subledger reconciliation', icon: ShieldCheck, tone: 'amber' },
    { label: 'Posted journals', value: String(journalControls.posted || 0), detail: `${journalControls.drafts || 0} drafts pending review`, icon: FileText, tone: 'rose' },
  ];

  return <main className="min-h-full bg-[linear-gradient(160deg,#060c18_0%,#080e1f_65%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><FileText className="h-3.5 w-3.5" /> Accounting Management / Reports</div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Management accounting reports</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Decision-ready financial statements and control summaries for the assigned property. Every export is generated from the live accounting registers.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">Business date <strong className="ml-1 text-slate-200">{reportDate}</strong></span><select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-xl border border-white/[0.08] bg-[#101827] px-3 py-2 text-xs font-semibold text-slate-300 outline-none"><option value="week">7 days</option><option value="month">This month</option><option value="quarter">Quarter</option><option value="year">Year</option></select><a href={`/api/v1/accountant/reports/export?propertyId=${encodeURIComponent(propertyId || '')}&report=pack&range=${range}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-[#06111b] transition hover:bg-emerald-300"><Download className="h-3.5 w-3.5" /> Export pack</a><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></div></header>
    <section className={`flex items-center gap-3 rounded-2xl border p-5 ${totalIssues ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'}`}>{totalIssues ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}<div><p className="text-sm font-semibold text-white">{totalIssues ? `${totalIssues} control items require accountant review` : 'Accounting controls are clear'}</p><p className="mt-1 text-xs text-slate-500">Latest night audit status: {data.audit?.lastAuditStatus || 'PENDING'}</p></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map((card) => <ReportMetric key={card.label} {...card} />)}</div>
    <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold text-white">Statement pack</h2><p className="mt-1 text-xs text-slate-500">Live P&amp;L, balance sheet, trial balance, cash flow, and GL control evidence</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${Math.abs(Number(statement.trialBalance?.summary?.debit || 0) - Number(statement.trialBalance?.summary?.credit || 0)) < .01 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{Math.abs(Number(statement.trialBalance?.summary?.debit || 0) - Number(statement.trialBalance?.summary?.credit || 0)) < .01 ? 'Trial balance agrees' : 'Trial balance requires review'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReportMetric label="Net profit / loss" value={money(statement.profitAndLoss?.summary?.balance)} detail={`${(statement.profitAndLoss?.rows || []).length} P&amp;L lines`} icon={CircleDollarSign} tone="emerald" /><ReportMetric label="Balance sheet check" value={money(statement.balanceSheet?.summary?.balance)} detail={`${(statement.balanceSheet?.rows || []).length} balance-sheet accounts`} icon={ShieldCheck} tone="blue" /><ReportMetric label="Posted journals" value={String(journalControls.posted || 0)} detail={`${journalControls.drafts || 0} drafts pending review`} icon={FileText} tone="amber" /><ReportMetric label="Current period" value={currentPeriod?.name || 'Not configured'} detail={currentPeriod?.status || 'No open period'} icon={Scale} tone="rose" /></div></section>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><BarChart3 className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Operating revenue curve</h2><p className="mt-1 text-xs text-slate-500">Posted revenue from the live business-date series</p></div></div><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{data.trends?.revenue?.days?.length || 0} observations</span></div><div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trends?.revenue?.days || []} margin={{top:8,right:4,left:-20,bottom:0}}><defs><linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={.3}/><stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="businessDate" tickFormatter={(v) => new Date(v).toLocaleDateString('en-NG',{weekday:'short'}).slice(0,3)} tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/><YAxis tickFormatter={(v) => `₦${(Number(v)/1000).toFixed(0)}k`} tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#101827',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'#f8fafc',fontSize:12}} formatter={(v) => [money(Number(v)), 'Revenue']}/><Area type="monotone" dataKey="revenue" stroke="#60a5fa" fill="url(#reportRevenue)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></section><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Financial position</h2><p className="mt-1 text-xs text-slate-500">Current ledger exposure by control area</p></div></div><div className="mt-5 space-y-2.5"><Row label="Cash and bank" value={money(balances.cashTotal)} /><Row label="Accounts receivable" value={money(balances.arTotal)} /><Row label="Accounts payable" value={money(balances.apOutstanding)} /><Row label="Tax liability" value={money(tax)} /></div></section></div><section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300"><AlertTriangle className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">Control exceptions</h2><p className="mt-1 text-xs text-slate-500">Exceptions impacting management confidence</p></div></div><div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5"><Row label="Open exceptions" value={String(flags.openExceptions || 0)} alert={Boolean(flags.openExceptions)} /><Row label="Overdue receivables" value={String(flags.overdueReceivables || 0)} alert={Boolean(flags.overdueReceivables)} /><Row label="Pending expenses" value={String(flags.pendingExpenses || 0)} alert={Boolean(flags.pendingExpenses)} /><Row label="GL exceptions" value={String(flags.glExceptions || 0)} alert={Boolean(flags.glExceptions)} /><Row label="Pending deposits" value={String(flags.pendingDeposits || 0)} alert={Boolean(flags.pendingDeposits)} /></div></section>
  </div></main>;
}

function Row({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 text-sm last:border-0 last:pb-0"><span className="text-slate-400">{label}</span><span className={`font-semibold ${alert ? 'text-amber-300' : 'text-slate-200'}`}>{value}</span></div>;
}

function ReportMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: ElementType; tone: 'emerald' | 'blue' | 'amber' | 'rose' }) {
  const toneClass = { emerald: 'border-emerald-400/20 bg-emerald-400/[0.07]', blue: 'border-blue-400/20 bg-blue-400/[0.07]', amber: 'border-amber-400/20 bg-amber-400/[0.07]', rose: 'border-rose-400/20 bg-rose-400/[0.07]' }[tone];
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}

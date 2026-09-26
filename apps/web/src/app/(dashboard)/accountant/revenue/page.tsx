'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { format } from 'date-fns';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileWarning,
  Filter,
  Percent,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DepartmentRevenue = {
  id: string;
  accountCode: string;
  accountName: string;
  department: string;
  category: string;
  isContra: boolean;
  today: number;
  mtd: number;
  ytd: number;
  priorYear: number;
  count: number;
  gross: number;
  discounts: number;
  variance: number | null;
  isUp: boolean;
};

type RevenueReport = {
  property: { name: string; currency: string };
  businessDate: string;
  snapshot: { today: number; mtd: number; ytd: number; priorYear: number; grossToday: number; discountsToday: number; complimentaryToday: number; transactionCountToday: number; variance: number | null; isUp: boolean };
  departments: DepartmentRevenue[];
  dailyTrend: { date: string; revenue: number; gross: number; discounts: number; transactions: number }[];
};

const money = (value: number, currency = 'NGN', compact = false) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, notation: compact && Math.abs(value) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: compact && Math.abs(value) >= 1000000 ? 1 : 0 }).format(Number(value || 0));
const pct = (value: number) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;
const tooltipStyle = { background: '#101827', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#f8fafc', fontSize: 12 };

async function loadRevenue(propertyId: string): Promise<RevenueReport> {
  const response = await fetch(`/api/v1/accountant/revenue?propertyId=${propertyId}`);
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(body.error?.message || body.error || 'Revenue report unavailable');
  return body.data ?? body;
}

function Kpi({ label, value, detail, icon: Icon, tone = 'emerald', trend }: { label: string; value: string; detail: string; icon: React.ElementType; tone?: string; trend?: string }) {
  const toneClass = tone === 'blue' ? 'bg-blue-400/10 text-blue-300' : tone === 'amber' ? 'bg-amber-400/10 text-amber-300' : tone === 'violet' ? 'bg-violet-400/10 text-violet-300' : 'bg-emerald-400/10 text-emerald-300';
  return <div className="rounded-2xl border border-white/[0.08] bg-[#111a2b]/80 p-5 shadow-[0_16px_40px_rgba(0,0,0,.12)]"><div className="flex items-start justify-between gap-3"><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</div><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-4 w-4" /></div></div><div className="mt-4 flex items-end justify-between gap-2"><div className="text-[26px] font-semibold tracking-[-.04em] text-white">{value}</div>{trend && <span className="mb-1 text-xs font-medium text-emerald-300">{trend}</span>}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111a2b]/75 shadow-[0_16px_40px_rgba(0,0,0,.10)] ${className}`}>{children}</section>;
}

export default function RevenueAccountingPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId;
  const [view, setView] = useState<'revenue' | 'activity'>('revenue');
  const reportQuery = useQuery({ queryKey: ['accountant-revenue', propertyId], queryFn: () => loadRevenue(propertyId as string), enabled: Boolean(propertyId), refetchInterval: 60000 });

  if (reportQuery.isLoading) return <div className="flex min-h-full items-center justify-center bg-[#09111f]"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400 border-t-transparent" /></div>;
  if (reportQuery.isError || !reportQuery.data) return <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#09111f] p-8 text-center text-slate-300"><FileWarning className="h-10 w-10 text-rose-300" /><p>Revenue data could not be loaded.</p></div>;

  const report = reportQuery.data;
  const { snapshot, departments, dailyTrend } = report;
  const discountRate = snapshot.grossToday > 0 ? (snapshot.discountsToday / snapshot.grossToday) * 100 : 0;
  const bestDepartment = [...departments].sort((a, b) => b.today - a.today)[0];
  const mix = departments.filter(item => item.today > 0).map((item, index) => ({ name: item.department, value: item.today, color: ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24', '#fb7185'][index % 5] }));
  const dayAverage = dailyTrend.length ? dailyTrend.reduce((sum, item) => sum + item.revenue, 0) / dailyTrend.length : 0;
  const insight = bestDepartment?.today > dayAverage ? `${bestDepartment.department} is carrying the day at ${money(bestDepartment.today, report.property.currency, true)}.` : 'Revenue is tracking close to the recent operating baseline.';
  const closeChecks = [
    { label: 'Department mapping', detail: `${departments.filter(item => item.count > 0).length} active revenue streams mapped`, ok: true },
    { label: 'Discount discipline', detail: `${discountRate.toFixed(1)}% of gross charges discounted today`, ok: discountRate < 10 },
    { label: 'Posting activity', detail: `${snapshot.transactionCountToday.toLocaleString()} charge transactions captured`, ok: snapshot.transactionCountToday > 0 },
  ];

  return <div className="min-h-full bg-[#09111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1480px] space-y-6">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Revenue control room</div><h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Revenue, reconciled.</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">A decision-grade view of departmental production, pricing discipline, revenue mix, and the signals that matter before the books close.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300"><CalendarDays className="h-4 w-4 text-emerald-300" /> Business date <span className="font-semibold text-white">{format(new Date(`${report.businessDate}T00:00:00`), 'dd MMM yyyy')}</span></div></div></div>

    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><div className="text-sm font-semibold text-white">Revenue close posture: {closeChecks.filter(item => item.ok).length}/{closeChecks.length} checks healthy</div><div className="mt-1 text-xs text-slate-400">{insight} Review variances before finalizing the business date.</div></div></div><Link href="/accountant/audit" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/[0.12]">Open income audit <ChevronRight className="h-3.5 w-3.5" /></Link></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Net revenue today" value={money(snapshot.today, report.property.currency, true)} detail={`${snapshot.transactionCountToday.toLocaleString()} posted charge transactions`} icon={CircleDollarSign} trend={snapshot.variance === null ? undefined : pct(snapshot.variance)} /><Kpi label="Month to date" value={money(snapshot.mtd, report.property.currency, true)} detail="Net revenue after contra-revenue" icon={TrendingUp} tone="blue" /><Kpi label="Year to date" value={money(snapshot.ytd, report.property.currency, true)} detail="Cumulative operating revenue" icon={BarChart3} tone="violet" /><Kpi label="Discount rate" value={`${discountRate.toFixed(1)}%`} detail={`${money(snapshot.discountsToday, report.property.currency, true)} discounts · ${money(snapshot.complimentaryToday, report.property.currency, true)} complimentary`} icon={Percent} tone="amber" /></div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]"><Panel><div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-emerald-300" /> Revenue production trend</div><p className="mt-1 text-xs text-slate-500">Gross production, discounts, and net revenue across the last 14 business days</p></div><div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1"><button onClick={() => setView('revenue')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${view === 'revenue' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Net revenue</button><button onClick={() => setView('activity')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${view === 'activity' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Transactions</button></div></div><div className="h-[310px] p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%">{view === 'revenue' ? <AreaChart data={dailyTrend} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="netRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => format(new Date(`${value}T00:00:00`), 'dd MMM')} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => money(Number(value), report.property.currency, true)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={62} /><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown, name: unknown) => [money(Number(value), report.property.currency), name === 'revenue' ? 'Net revenue' : name === 'gross' ? 'Gross charges' : 'Discounts']} labelFormatter={(value: unknown) => format(new Date(`${String(value)}T00:00:00`), 'dd MMM yyyy')} /><Area type="monotone" dataKey="gross" stroke="#60a5fa" fill="none" strokeWidth={1.5} strokeDasharray="4 4" /><Area type="monotone" dataKey="revenue" stroke="#34d399" fill="url(#netRevenue)" strokeWidth={2.5} /></AreaChart> : <BarChart data={dailyTrend} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => format(new Date(`${value}T00:00:00`), 'dd MMM')} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={36} /><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value).toLocaleString(), 'Transactions']} /><Bar dataKey="transactions" fill="#60a5fa" radius={[5, 5, 0, 0]} /></BarChart>}</ResponsiveContainer></div><div className="flex items-center gap-5 border-t border-white/[0.07] px-5 py-3 text-[11px] text-slate-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Net revenue</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-400" /> Gross charges</span><span className="ml-auto">14-day average: {money(dayAverage, report.property.currency, true)}</span></div></Panel>
      <Panel><div className="border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Tags className="h-4 w-4 text-blue-300" /> Revenue mix</div><p className="mt-1 text-xs text-slate-500">Net contribution by mapped department</p></div><div className="flex items-center gap-4 p-5"><div className="h-[160px] w-[160px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mix.length ? mix : [{ name: 'No activity', value: 1, color: '#334155' }]} dataKey="value" innerRadius={52} outerRadius={73} paddingAngle={3} stroke="none">{(mix.length ? mix : [{ color: '#334155' }]).map((item, index) => <Cell key={index} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => money(Number(value), report.property.currency)} /></PieChart></ResponsiveContainer></div><div className="min-w-0 flex-1 space-y-3">{(mix.length ? mix : [{ name: 'No activity', value: 0, color: '#334155' }]).map(item => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-medium text-slate-200">{money(item.value, report.property.currency, true)}</span></div>)}</div></div><div className="mx-5 mb-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Gross charges today</span><span className="font-semibold text-white">{money(snapshot.grossToday, report.property.currency, true)}</span></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">Less discounts</span><span className="font-semibold text-amber-200">−{money(snapshot.discountsToday, report.property.currency, true)}</span></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">Less complimentary</span><span className="font-semibold text-amber-200">−{money(snapshot.complimentaryToday, report.property.currency, true)}</span></div></div></Panel></div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><Panel><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 className="h-4 w-4 text-violet-300" /> Chart of accounts revenue</div><p className="mt-1 text-xs text-slate-500">Every active revenue and contra-revenue account, reconciled to folio and direct POS activity</p></div><button className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" title="Filter revenue accounts"><Filter className="h-4 w-4" /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead><tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[.14em] text-slate-500"><th className="px-5 py-3 font-semibold">Account</th><th className="px-5 py-3 font-semibold text-right">Net today</th><th className="px-5 py-3 font-semibold text-right">Gross / discounts</th><th className="px-5 py-3 font-semibold text-right">MTD</th><th className="px-5 py-3 font-semibold text-right">YoY</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{departments.map(item => <tr key={item.id} className="group transition hover:bg-white/[0.03]"><td className="px-5 py-4"><div className="flex items-center gap-2 font-medium text-slate-200"><span className="font-mono text-[11px] text-emerald-300">{item.accountCode}</span>{item.accountName}</div><div className="mt-1 text-[11px] text-slate-500">{item.category} · {item.count.toLocaleString()} charge transactions</div></td><td className={`px-5 py-4 text-right font-semibold ${item.isContra ? 'text-amber-200' : 'text-white'}`}>{money(item.today, report.property.currency, true)}</td><td className="px-5 py-4 text-right text-xs"><div className="text-slate-300">{money(item.gross, report.property.currency, true)}</div><div className="mt-1 text-amber-300/80">−{money(item.discounts, report.property.currency, true)}</div></td><td className="px-5 py-4 text-right text-slate-300">{money(item.mtd, report.property.currency, true)}</td><td className="px-5 py-4 text-right">{item.variance === null ? <span className="text-xs text-slate-600">No baseline</span> : <span className={`inline-flex items-center gap-1 text-xs font-semibold ${item.isUp ? 'text-emerald-300' : 'text-rose-300'}`}>{item.isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{pct(item.variance)}</span>}</td></tr>)}</tbody></table></div></Panel>
      <Panel><div className="border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Revenue integrity</div><p className="mt-1 text-xs text-slate-500">Pre-close checks for the current business date</p></div><div className="space-y-3 p-5">{closeChecks.map(check => <div key={check.label} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${check.ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{check.ok ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}</div><div><div className="text-xs font-semibold text-slate-200">{check.label}</div><div className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</div></div></div>)}<div className="border-t border-white/[0.07] pt-4"><Link href="/accountant/gl" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200">Review GL mappings <ArrowUpRight className="h-3.5 w-3.5" /></Link><p className="mt-2 text-[11px] leading-4 text-slate-600">Revenue departments should reconcile to transaction-code mappings before posting the final close journal.</p></div></div></Panel></div>

    <Panel><div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><CircleDollarSign className="h-4 w-4 text-emerald-300" /> Next best actions</div><p className="mt-1 text-xs text-slate-500">Move from insight to controlled accounting workflow</p></div></div><div className="grid border-t border-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]"><Link href="/accountant/audit" className="group flex items-center justify-between gap-3 p-4 hover:bg-white/[0.03]"><span><span className="block text-sm font-medium text-slate-200">Run income audit</span><span className="mt-1 block text-xs text-slate-500">Validate the business date before close</span></span><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-300" /></Link><Link href="/accountant/gl" className="group flex items-center justify-between gap-3 border-t border-white/[0.07] p-4 hover:bg-white/[0.03] sm:border-t-0"><span><span className="block text-sm font-medium text-slate-200">Review posting rules</span><span className="mt-1 block text-xs text-slate-500">Inspect revenue and tax account mappings</span></span><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-300" /></Link><Link href="/accountant/reports" className="group flex items-center justify-between gap-3 border-t border-white/[0.07] p-4 hover:bg-white/[0.03] sm:border-t-0"><span><span className="block text-sm font-medium text-slate-200">Open revenue reports</span><span className="mt-1 block text-xs text-slate-500">Open the controlled departmental view</span></span><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-300" /></Link></div></Panel>
  </div></div>;
}

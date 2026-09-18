'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  FileWarning,
  Landmark,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const money = (amount: number = 0, compact = false) => {
  const value = Number(amount || 0);
  return `₦${new Intl.NumberFormat('en-NG', {
    notation: compact && Math.abs(value) >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && Math.abs(value) >= 1000000 ? 1 : 0,
  }).format(value)}`;
};

const tooltipStyle = {
  background: '#101827',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 12,
  color: '#f8fafc',
  fontSize: 12,
};

function MetricCard({ label, value, detail, icon: Icon, tone = 'emerald', trend }: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone?: 'emerald' | 'blue' | 'amber' | 'violet';
  trend?: string;
}) {
  const tones = {
    emerald: 'bg-emerald-400/10 text-emerald-300 ring-emerald-300/10',
    blue: 'bg-blue-400/10 text-blue-300 ring-blue-300/10',
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-300/10',
    violet: 'bg-violet-400/10 text-violet-300 ring-violet-300/10',
  };
  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-[#111a2b]/80 p-5 shadow-[0_16px_40px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:border-white/[0.15]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="text-[26px] font-semibold tracking-[-.04em] text-white">{value}</div>
        {trend && <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><ArrowUpRight className="h-3.5 w-3.5" />{trend}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111a2b]/75 shadow-[0_16px_40px_rgba(0,0,0,.10)] ${className}`}>{children}</section>;
}

export default function AccountantOverviewPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId;
  const [range, setRange] = useState('7D');

  const { data: kpis, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['accountant-kpis', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dashboard/accountant-analytics?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch finance analytics');
      return res.json();
    },
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  const revenueToday = Number(kpis?.revenue?.today?.totalRevenue || 0);
  const revenueYesterday = Number(kpis?.revenue?.yesterday?.totalRevenue || 0);
  const revGrowth = revenueYesterday ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : 0;
  const balances = kpis?.balances || {};
  const flags = kpis?.flags || {};
  const cashFlow = Array.isArray(kpis?.trends?.cashFlow) ? kpis.trends.cashFlow : [];
  const revenueTrend = Array.isArray(kpis?.trends?.revenue?.days) ? kpis.trends.revenue.days : [];
  const revenueMix = useMemo(() => [
    { name: 'Rooms', value: Number(kpis?.revenue?.today?.roomRevenue || 0), color: '#34d399' },
    { name: 'F&B', value: Number(kpis?.revenue?.today?.fbRevenue || 0), color: '#60a5fa' },
    { name: 'Bar', value: Number(kpis?.revenue?.today?.barRevenue || 0), color: '#a78bfa' },
    { name: 'Other', value: Number(kpis?.revenue?.today?.otherRevenue || 0), color: '#fbbf24' },
  ].filter(item => item.value > 0), [kpis]);

  if (isLoading) return <div className="flex min-h-[80vh] items-center justify-center bg-[#09111f]"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400 border-t-transparent" /></div>;
  if (isError || !kpis) return <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 bg-[#09111f] p-8 text-center text-white"><FileWarning className="h-10 w-10 text-rose-300" /><div><h2 className="font-semibold">Finance data is unavailable</h2><p className="mt-1 text-sm text-slate-400">We could not load the live accountant dashboard.</p></div><button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Try again</button></div>;

  const businessDate = kpis.businessDate ? new Date(kpis.businessDate) : new Date();
  const totalIssues = Object.values(flags).reduce((sum: number, value: unknown) => sum + Number(value || 0), 0);
  const closeReady = totalIssues === 0 && kpis.audit?.lastAuditStatus === 'COMPLETED';
  const netCash = cashFlow.at(-1)?.net || 0;
  const exportCsv = () => {
    const rows = [['Metric', 'Value'], ['Business date', format(businessDate, 'yyyy-MM-dd')], ['Revenue today', revenueToday], ['Cash position', balances.cashTotal || 0], ['Accounts receivable', balances.arTotal || 0], ['Accounts payable', balances.apOutstanding || 0], ['Tax liability', balances.taxLiability?.total || 0], ['Open controls', totalIssues]];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `finance-overview-${format(businessDate, 'yyyy-MM-dd')}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const controls = [
    { title: 'Open exceptions', count: flags.openExceptions, href: '/cash-management/transaction-exceptions', tone: 'rose', icon: AlertCircle },
    { title: 'Overdue receivables', count: flags.overdueReceivables, href: '/accountant/city-ledger', tone: 'amber', icon: Clock3 },
    { title: 'Supplier invoices due', count: flags.overdueInvoices, href: '/accountant/payables', tone: 'amber', icon: WalletCards },
    { title: 'Expense approvals', count: flags.pendingExpenses, href: '/accountant/expenses', tone: 'blue', icon: ListChecks },
    { title: 'Bank deposits to post', count: flags.pendingDeposits, href: '/accountant/cash-bank', tone: 'blue', icon: Landmark },
    { title: 'GL drafts', count: flags.glExceptions, href: '/accountant/gl', tone: 'violet', icon: Scale },
  ].filter(item => Number(item.count || 0) > 0);

  return (
    <div className="min-h-full bg-[#09111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Finance command centre</div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Good morning, let’s close clean.</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">A live view of revenue integrity, liquidity, ledger exposure, and the controls that need an accountant’s attention.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300"><CalendarDays className="h-4 w-4 text-emerald-300" /> Business date <span className="font-semibold text-white">{format(businessDate, 'dd MMM yyyy')}</span></div>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"><Download className="h-4 w-4" /> Export</button>
            <button onClick={() => refetch()} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 transition hover:bg-white/[0.08]" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>

        <div className={`flex flex-col justify-between gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center ${closeReady ? 'border-emerald-400/20 bg-emerald-400/[0.07]' : 'border-amber-300/20 bg-amber-300/[0.06]'}`}>
          <div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${closeReady ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-300/15 text-amber-200'}`}>{closeReady ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}</div><div><div className="text-sm font-semibold text-white">{closeReady ? 'Close readiness: all clear' : `${totalIssues} control${totalIssues === 1 ? '' : 's'} need review before close`}</div><div className="mt-1 text-xs text-slate-400">Night audit: <span className="font-medium text-slate-300">{kpis.audit?.lastAuditStatus || 'PENDING'}</span>{kpis.audit?.lastAuditDate ? ` · last completed ${format(new Date(kpis.audit.lastAuditDate), 'dd MMM')}` : ''}</div></div></div>
          <Link href={closeReady ? '/accountant/audit' : '/accountant/audit'} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.12]">Open audit workspace <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Revenue today" value={money(revenueToday, true)} detail="Posted + expected room revenue" icon={CircleDollarSign} trend={`${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}% vs yesterday`} />
          <MetricCard label="Cash & bank" value={money(balances.cashTotal, true)} detail={`${money(balances.safe)} safe · ${money(balances.bank)} bank`} icon={Banknote} tone="blue" />
          <MetricCard label="Receivables" value={money(balances.arTotal, true)} detail="Guest ledger + city ledger exposure" icon={WalletCards} tone="amber" />
          <MetricCard label="Payables" value={money(balances.apOutstanding, true)} detail={`${flags.overdueInvoices || 0} supplier invoices overdue`} icon={Landmark} tone="violet" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
          <Panel>
            <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 className="h-4 w-4 text-emerald-300" /> Revenue performance</div><p className="mt-1 text-xs text-slate-500">Revenue and occupancy over the selected business window</p></div><div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1">{['7D', '14D'].map(item => <button key={item} onClick={() => setRange(item)} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${range === item ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{item}</button>)}</div></div>
            <div className="h-[300px] p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={range === '14D' ? revenueTrend : revenueTrend.slice(-7)} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={.28} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="businessDate" tickFormatter={(value) => format(new Date(value), 'dd MMM')} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="revenue" tickFormatter={(value) => money(Number(value), true)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} /><YAxis yAxisId="occupancy" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={38} /><Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [name === 'revenue' ? money(Number(value)) : `${value}%`, name === 'revenue' ? 'Revenue' : 'Occupancy']} labelFormatter={(value: any) => format(new Date(value), 'dd MMM yyyy')} /><Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#34d399" fill="url(#revenueFill)" strokeWidth={2.5} /><Line yAxisId="occupancy" type="monotone" dataKey="occupancyPct" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa', strokeWidth: 0 }} /></ComposedChart></ResponsiveContainer></div>
            <div className="flex items-center gap-5 border-t border-white/[0.07] px-5 py-3 text-[11px] text-slate-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Revenue</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-400" /> Occupancy</span><span className="ml-auto text-slate-600">Updated {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm') : '—'}</span></div>
          </Panel>

          <Panel>
            <div className="border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><CircleDollarSign className="h-4 w-4 text-blue-300" /> Revenue mix</div><p className="mt-1 text-xs text-slate-500">Today by operating department</p></div>
            <div className="flex items-center gap-4 p-5"><div className="h-[166px] w-[166px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={revenueMix.length ? revenueMix : [{ name: 'No revenue', value: 1, color: '#334155' }]} dataKey="value" innerRadius={53} outerRadius={76} paddingAngle={3} stroke="none">{(revenueMix.length ? revenueMix : [{ color: '#334155' }]).map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: any) => money(Number(value))} /></PieChart></ResponsiveContainer></div><div className="min-w-0 flex-1 space-y-3">{(revenueMix.length ? revenueMix : [{ name: 'No activity', value: 0, color: '#334155' }]).map(item => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-medium text-slate-200">{money(item.value, true)}</span></div>)}</div></div>
            <div className="mx-5 mb-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Tax liability this month</span><span className="font-semibold text-amber-200">{money(balances.taxLiability?.total, true)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-300 to-orange-400" /></div></div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><ActivityIcon /> Liquidity movement</div><p className="mt-1 text-xs text-slate-500">Cash inflows against operational outflows</p></div><Link href="/accountant/cash-bank" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">Open cash & bank <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
            <div className="h-[252px] p-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashFlow} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={.24} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient><linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={.2} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'EEE')} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => money(Number(value), true)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} /><Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [money(Number(value)), name === 'inflow' ? 'Inflows' : 'Outflows']} /><Area type="monotone" dataKey="inflow" stroke="#60a5fa" fill="url(#inflow)" strokeWidth={2} /><Area type="monotone" dataKey="outflow" stroke="#fb7185" fill="url(#outflow)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div><div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-xs"><span className="text-slate-500">Net movement today</span><span className={`font-semibold ${netCash >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{netCash >= 0 ? '+' : ''}{money(netCash)}</span></div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><Scale className="h-4 w-4 text-violet-300" /> Balance sheet watch</div><p className="mt-1 text-xs text-slate-500">Key exposures that affect close confidence</p></div><Link href="/accountant/gl" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><MoreHorizontal className="h-4 w-4" /></Link></div>
            <div className="grid grid-cols-2 gap-px bg-white/[0.07]">{[{ label: 'Cash & bank', value: balances.cashTotal, icon: Banknote, color: 'text-blue-300' }, { label: 'Accounts receivable', value: balances.arTotal, icon: WalletCards, color: 'text-amber-300' }, { label: 'Accounts payable', value: balances.apOutstanding, icon: Landmark, color: 'text-rose-300' }, { label: 'Tax liability', value: balances.taxLiability?.total, icon: Scale, color: 'text-violet-300' }].map(item => <div key={item.label} className="bg-[#111a2b] p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><item.icon className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</div><div className="mt-2 text-lg font-semibold tracking-[-.03em] text-white">{money(item.value, true)}</div><div className="mt-1 text-[10px] text-slate-600">Ledger balance</div></div>)}</div>
          </Panel>
        </div>

        <Panel>
          <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><ListChecks className="h-4 w-4 text-amber-300" /> Accountant work queue</div><p className="mt-1 text-xs text-slate-500">Prioritized controls and approvals blocking a clean close</p></div><Link href="/accountant/audit" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">View audit trail <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
          {controls.length ? <div className="grid divide-y divide-white/[0.06] md:grid-cols-2 md:divide-y-0 md:divide-x">{controls.map(item => <Link href={item.href} key={item.title} className="group flex items-center justify-between gap-4 p-4 transition hover:bg-white/[0.03] md:odd:border-b md:even:border-b"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone === 'rose' ? 'bg-rose-400/10 text-rose-300' : item.tone === 'amber' ? 'bg-amber-400/10 text-amber-300' : item.tone === 'blue' ? 'bg-blue-400/10 text-blue-300' : 'bg-violet-400/10 text-violet-300'}`}><item.icon className="h-4 w-4" /></div><div><div className="text-sm font-medium text-slate-200">{item.title}</div><div className="mt-0.5 text-xs text-slate-500">Needs accountant review</div></div></div><div className="flex items-center gap-2"><span className="text-lg font-semibold text-white">{item.count}</span><ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-emerald-300" /></div></Link>)}</div> : <div className="flex items-center gap-3 p-6 text-sm text-slate-400"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></div>All accounting controls are clear for this business date.</div>}
        </Panel>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return <svg viewBox="0 0 16 16" className="h-4 w-4 text-blue-300" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 9.5h2l1.4-5 2.2 8 1.6-5H14" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

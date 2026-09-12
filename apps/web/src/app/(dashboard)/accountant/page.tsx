'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
  Building, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  Wallet,
  Activity,
  ArrowRight,
  CalendarClock,
  Download,
  FileWarning,
  RefreshCw
} from 'lucide-react';

export default function AccountantOverviewPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId; // Default to first property

  const { data: kpis, isLoading, isError, refetch } = useQuery({
    queryKey: ['accountant-kpis', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dashboard/accountant-analytics?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    },
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !kpis) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <FileWarning className="h-10 w-10 text-rose-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Finance data is unavailable</h2>
          <p className="mt-1 text-sm text-slate-400">We could not load the live accountant dashboard.</p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  const formatCurrency = (amount: number = 0) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  // The analytics API returns a RevenueSnapshot for each day, not a scalar.
  // Read totalRevenue explicitly so the card does not coerce the object to NaN
  // and silently render the fallback value of ₦0.00.
  const currentRev = Number(kpis?.revenue?.today?.totalRevenue ?? 0);
  const previousRev = Number(kpis?.revenue?.yesterday?.totalRevenue ?? 0);
  const hasRevenueBaseline = previousRev > 0;
  const revGrowth = hasRevenueBaseline ? ((currentRev - previousRev) / previousRev) * 100 : null;

  const currentExpenses = kpis?.balances?.apOutstanding || 0;
  const arTotal = kpis?.balances?.arTotal || 0;
  const pendingExceptions = kpis?.flags?.pendingExceptions || 0;
  const cashFlow = Array.isArray(kpis?.trends?.cashFlow) ? kpis.trends.cashFlow : [];
  const flags = kpis.flags || {};

  const downloadReport = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Revenue today', currentRev],
      ['Revenue yesterday', previousRev],
      ['Accounts receivable', arTotal],
      ['Accounts payable', currentExpenses],
      ['Tax liability', kpis.balances?.taxLiability || 0],
      ['Safe balance', kpis.balances?.safe || 0],
      ['Open exceptions', pendingExceptions],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `accountant-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const pendingActions = [
    { title: 'Expense approvals', description: 'Cash expenses awaiting review', count: flags.pendingExpenses || 0, href: '/accountant/expenses', icon: Wallet, tone: 'amber' },
    { title: 'Bank deposits', description: 'Draft deposits requiring control', count: flags.pendingDeposits || 0, href: '/accountant/cash-bank', icon: CreditCard, tone: 'indigo' },
    { title: 'Cash handovers', description: 'Pending cashier handovers', count: flags.pendingHandovers || 0, href: '/accountant/cash-bank', icon: DollarSign, tone: 'emerald' },
    { title: 'Overdue invoices', description: 'Supplier invoices past due date', count: flags.overdueInvoices || 0, href: '/accountant/payables', icon: FileWarning, tone: 'rose' },
  ];

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Finance Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time financial performance and cash control.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadReport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <Link href="/accountant/settings" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/50 transition-colors">
            <CalendarClock className="h-4 w-4" /> Period controls
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 border border-white/5 shadow-xl transition-all hover:border-emerald-500/30 hover:shadow-emerald-900/20">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-medium text-slate-400">Total Revenue</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-3xl font-bold text-white tracking-tight">{formatCurrency(Number(currentRev) || 0)}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1 font-medium ${revGrowth === null ? 'text-slate-400' : revGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {revGrowth === null ? '—' : revGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revGrowth === null ? 'No prior-day baseline' : `${Math.abs(revGrowth).toFixed(1)}%`}
              </span>
              <span className="text-slate-500">vs previous business day</span>
            </div>
          </div>
        </div>

        {/* Expenses (Cash Out) */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 border border-white/5 shadow-xl transition-all hover:border-amber-500/30 hover:shadow-amber-900/20">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-all group-hover:bg-amber-500/20" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-medium text-slate-400">Accounts Payable</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-3xl font-bold text-white tracking-tight">{formatCurrency(Number(currentExpenses) || 0)}</span>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Outstanding supplier invoices</span>
            </div>
          </div>
        </div>

        {/* Receivables */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 border border-white/5 shadow-xl transition-all hover:border-indigo-500/30 hover:shadow-indigo-900/20">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:bg-indigo-500/20" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-medium text-slate-400">A/R Balance</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-3xl font-bold text-white tracking-tight">{formatCurrency(Number(arTotal) || 0)}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-500">Guest + city ledger</span>
            </div>
          </div>
        </div>

        {/* Exceptions */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 border border-white/5 shadow-xl transition-all hover:border-rose-500/30 hover:shadow-rose-900/20">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl transition-all group-hover:bg-rose-500/20" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-medium text-slate-400">Open Exceptions</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-3xl font-bold text-white tracking-tight">{pendingExceptions}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-rose-400 font-medium">Requires attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
          <div className="flex items-center justify-between border-b border-white/5 p-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Cash Flow Trend</h3>
              <p className="mt-1 text-xs text-slate-500">Live posted inflows and outflows for the last 8 business days.</p>
            </div>
            <Link href="/accountant/cash-bank" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Open cash control <ArrowRight className="ml-1 inline h-3 w-3" /></Link>
          </div>
          <div className="min-h-[300px] flex-1 p-4 pt-6">
            {cashFlow.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cashFlow}>
                  <defs>
                    <linearGradient id="cashIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                    <linearGradient id="cashOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb7185" stopOpacity={0.25} /><stop offset="95%" stopColor="#fb7185" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => String(value).slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₦${Number(value).toLocaleString('en-NG')}`} width={75} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff1a', borderRadius: 10, color: '#fff' }} formatter={(value: any) => [`₦${Number(value || 0).toLocaleString('en-NG')}`, '']} />
                  <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#34d399" fill="url(#cashIn)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#fb7185" fill="url(#cashOut)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">No cash-flow activity recorded for this period.</div>}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
            <div className="border-b border-white/5 p-5">
              <h3 className="text-base font-semibold text-white">Pending Controls</h3>
            </div>
            <div className="p-2">
              {pendingActions.map((item) => {
                const Icon = item.icon;
                return <Link href={item.href} key={item.title} className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5 group">
                  <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-slate-500 group-hover:text-emerald-400" /><div className="flex flex-col"><span className="text-sm font-medium text-slate-200 group-hover:text-emerald-400">{item.title}</span><span className="text-xs text-slate-500">{item.description}</span></div></div>
                  <span className="min-w-7 rounded-full bg-white/10 px-2 py-1 text-center text-xs font-semibold text-white">{item.count}</span>
                </Link>;
              })}
            </div>
            <div className="p-3 pt-0">
              <Link href="/accountant/audit" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/10 transition-colors">
                Open audit workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

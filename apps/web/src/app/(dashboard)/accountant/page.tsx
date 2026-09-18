'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
  Building, 
  CreditCard,
  Wallet,
  ArrowRight,
  Download,
  FileWarning,
  RefreshCw,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';

export default function AccountantOverviewPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId;

  const [period, setPeriod] = useState('Today');

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
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !kpis) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 p-8 text-center bg-slate-950">
        <FileWarning className="h-10 w-10 text-rose-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Finance data is unavailable</h2>
          <p className="mt-1 text-sm text-slate-400">We could not load the live accountant dashboard.</p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  const formatCurrency = (amount: number = 0) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const businessDate = kpis.businessDate ? new Date(kpis.businessDate) : new Date();
  
  const currentRev = Number(kpis?.revenue?.today?.totalRevenue ?? 0);
  const previousRev = Number(kpis?.revenue?.yesterday?.totalRevenue ?? 0);
  const revGrowth = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : null;

  const arTotal = kpis?.balances?.arTotal || 0;
  const apOutstanding = kpis?.balances?.apOutstanding || 0;
  const cashFlow = Array.isArray(kpis?.trends?.cashFlow) ? kpis.trends.cashFlow : [];
  const todayNetCash = cashFlow.length > 0 ? cashFlow[cashFlow.length - 1].net : 0;
  
  const flags = kpis.flags || {};

  const downloadReport = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Business Date', kpis.businessDate],
      ['Revenue today', currentRev],
      ['Revenue yesterday', previousRev],
      ['Accounts receivable', arTotal],
      ['Accounts payable', apOutstanding],
      ['Cash Position', kpis.balances?.cashTotal || 0],
      ['Tax liability', kpis.balances?.taxLiability?.total || 0],
      ['Open exceptions', flags.openExceptions || 0],
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

  // 🔴 High Priority / Exceptions
  // 🟠 Medium Priority / Approvals
  // 🟡 Low Priority / Operations
  const controlCenterItems = [
    { title: 'Open Accounting Exceptions', count: flags.openExceptions || 0, priority: 'high', href: '/cash-management/transaction-exceptions' },
    { title: 'Overdue Receivables', count: flags.overdueReceivables || 0, priority: 'high', href: '/accountant/city-ledger' },
    { title: 'Overdue Supplier Invoices', count: flags.overdueInvoices || 0, priority: 'high', href: '/accountant/payables' },
    { title: 'Pending Expense Approvals', count: flags.pendingExpenses || 0, priority: 'medium', href: '/accountant/expenses' },
    { title: 'Pending Bank Deposits', count: flags.pendingDeposits || 0, priority: 'medium', href: '/accountant/cash-bank' },
    { title: 'Pending Cash Handovers', count: flags.pendingHandovers || 0, priority: 'low', href: '/accountant/cash-bank' },
    { title: 'GL Posting Exception', count: flags.glExceptions || 0, priority: 'low', href: '/accountant/gl' },
    { title: 'Reconciliation Differences', count: flags.reconciliationDifferences || 0, priority: 'low', href: '/accountant/cash-bank' },
  ].filter(item => item.count > 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'medium': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'low': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟠';
      case 'low': return '🟡';
      default: return '⚪';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-200 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Accountant</h1>
            <div className="mt-2 flex items-center gap-4 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Calendar className="h-4 w-4 text-indigo-400" />
                Business Date: {format(businessDate, 'dd MMM yyyy')}
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                Night Audit: 
                <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${kpis.audit?.lastAuditStatus === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {kpis.audit?.lastAuditStatus || 'PENDING'}
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="appearance-none rounded-lg bg-slate-900 border border-white/10 pl-4 pr-10 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="7 Days">7 Days</option>
                <option value="MTD">MTD</option>
                <option value="Custom">Custom</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={downloadReport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
              <Download className="h-4 w-4" />
              Reports
            </button>
          </div>
        </div>

        {/* Tier 1: KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-sm transition-colors hover:bg-slate-800/80">
            <div className="text-sm font-medium text-slate-400">Revenue</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{formatCurrency(currentRev)}</div>
            <div className="mt-1 flex items-center text-xs">
              {revGrowth !== null ? (
                <>
                  <span className={revGrowth >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                    {revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(1)}%
                  </span>
                  <span className="ml-1.5 text-slate-500">vs yesterday</span>
                </>
              ) : (
                <span className="text-slate-500">No prior baseline</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-sm transition-colors hover:bg-slate-800/80">
            <div className="text-sm font-medium text-slate-400">A/R</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{formatCurrency(arTotal)}</div>
            <div className="mt-1 text-xs text-slate-500">outstanding</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-sm transition-colors hover:bg-slate-800/80">
            <div className="text-sm font-medium text-slate-400">A/P</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{formatCurrency(apOutstanding)}</div>
            <div className="mt-1 text-xs text-slate-500">outstanding</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-sm transition-colors hover:bg-slate-800/80">
            <div className="text-sm font-medium text-slate-400">Net Cash</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{formatCurrency(todayNetCash)}</div>
            <div className="mt-1 text-xs text-slate-500">today</div>
          </div>
        </div>

        {/* Tier 2: Main Charts & Financial Position */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-sm">
            <div className="border-b border-white/10 p-5">
              <h3 className="text-base font-semibold text-white">Cash Movement — Last 7 Business Days</h3>
              <p className="mt-1 text-xs text-slate-400">Inflows / Outflows</p>
            </div>
            <div className="min-h-[300px] flex-1 p-4 pt-6">
              {cashFlow.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cashFlow}>
                    <defs>
                      <linearGradient id="cashIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cashOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => format(new Date(value), 'E')} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₦${Number(value).toLocaleString('en-NG')}`} width={70} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff1a', borderRadius: 8, color: '#fff', fontSize: '13px' }} formatter={(value: any, name: string) => [`₦${Number(value || 0).toLocaleString('en-NG')}`, name === 'inflow' ? 'Inflows' : name === 'outflow' ? 'Outflows' : 'Net Movement']} labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')} />
                    <Area type="monotone" dataKey="inflow" name="inflow" stroke="#34d399" fill="url(#cashIn)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" name="outflow" stroke="#f43f5e" fill="url(#cashOut)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">No cash movement recorded for this period.</div>}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-sm">
            <div className="border-b border-white/10 p-5">
              <h3 className="text-base font-semibold text-white">Financial Position</h3>
            </div>
            <div className="flex-1 p-5 space-y-6">
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Assets</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Cash Position</span>
                    <span className="text-sm font-medium text-white">{formatCurrency(kpis.balances?.cashTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Accounts Receivable</span>
                    <span className="text-sm font-medium text-white">{formatCurrency(arTotal)}</span>
                  </div>
                </div>
              </div>
              
              <div className="h-px bg-white/10" />
              
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Liabilities</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Accounts Payable</span>
                    <span className="text-sm font-medium text-white">{formatCurrency(apOutstanding)}</span>
                  </div>
                  <div className="flex justify-between items-center group relative">
                    <span className="text-sm text-slate-300">Total Tax Liability</span>
                    <span className="text-sm font-medium text-white">{formatCurrency(kpis.balances?.taxLiability?.total || 0)}</span>
                    {/* Tooltip for Tax Date */}
                    {kpis.balances?.taxLiability?.lastCalculationDate && (
                      <div className="absolute left-0 -top-8 hidden group-hover:block bg-slate-800 text-xs text-white px-2 py-1 rounded shadow-lg border border-white/10 whitespace-nowrap z-10">
                        Calculated: {format(new Date(kpis.balances.taxLiability.lastCalculationDate), 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Tier 3: Accounting Control Center */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-sm">
          <div className="border-b border-white/10 bg-slate-900/50 p-5 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-wide text-white uppercase">Accounting Control Center</h3>
            <span className="text-xs font-medium text-slate-400">{controlCenterItems.length} categories need review</span>
          </div>
          
          <div className="divide-y divide-white/5">
            {controlCenterItems.length > 0 ? (
              controlCenterItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 px-5 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-4">
                    <span className="text-lg leading-none" aria-hidden="true">{getPriorityDot(item.priority)}</span>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded border font-semibold text-xs ${getPriorityColor(item.priority)}`}>
                        {item.count}
                      </span>
                      <span className="text-sm font-medium text-slate-200">{item.title}</span>
                    </div>
                  </div>
                  <Link href={item.href} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Review <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-medium text-slate-200">All controls clear</h4>
                <p className="mt-1 text-xs text-slate-500">No pending exceptions, approvals, or anomalies require intervention.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

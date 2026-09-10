'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { 
  Building, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  Wallet,
  Activity,
  ArrowRight,
  PieChart as PieChartIcon
} from 'lucide-react';

export default function AccountantOverviewPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId; // Default to first property

  const { data: kpis, isLoading } = useQuery({
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

  const formatCurrency = (amount: number = 0) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const currentRev = kpis?.revenue?.today || 0;
  const previousRev = kpis?.revenue?.yesterday || 0;
  const revGrowth = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;

  const currentExpenses = kpis?.balances?.apOutstanding || 0;
  const arTotal = kpis?.balances?.arTotal || 0;
  const pendingExceptions = kpis?.flags?.pendingExceptions || 0;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Finance Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time financial performance and cash control.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
            Download Report
          </button>
          <button className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/50 transition-colors">
            Month-End Close
          </button>
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
            <span className="text-3xl font-bold text-white tracking-tight">₦{formatCurrency(currentRev).replace('$', '')}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 font-medium ₦{revGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {revGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(revGrowth).toFixed(1)}%
              </span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>
        </div>

        {/* Expenses (Cash Out) */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 border border-white/5 shadow-xl transition-all hover:border-amber-500/30 hover:shadow-amber-900/20">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-all group-hover:bg-amber-500/20" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-medium text-slate-400">Cash Expenses</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-3xl font-bold text-white tracking-tight">₦{formatCurrency(currentExpenses).replace('$', '')}</span>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <span>This period</span>
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
            <span className="text-3xl font-bold text-white tracking-tight">₦{formatCurrency(arTotal).replace('$', '')}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-500">Outstanding</span>
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
              <span className="text-rose-400 font-medium">Requires audit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
          <div className="border-b border-white/5 p-6">
            <h3 className="text-lg font-semibold text-white">Cash Flow Trend</h3>
          </div>
          <div className="flex-1 p-6 flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center text-slate-500 gap-3">
              <PieChartIcon className="h-10 w-10 opacity-20" />
              <p>Cash flow visualization will render here.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
            <div className="border-b border-white/5 p-5">
              <h3 className="text-base font-semibold text-white">Pending Approvals</h3>
            </div>
            <div className="p-2">
              {[
                { title: 'Tax Remittance', desc: 'VAT Q3 2026', time: '2 hours ago', amount: '₦4,250.00' },
                { title: 'Supplier Invoice', desc: 'Sysco Foods', time: '5 hours ago', amount: '₦1,842.20' },
                { title: 'Payroll Run', desc: 'September Week 1', time: '1 day ago', amount: '₦12,400.00' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">{item.title}</span>
                    <span className="text-xs text-slate-500">{item.desc} &bull; {item.time}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{item.amount}</span>
                </div>
              ))}
            </div>
            <div className="p-3 pt-0">
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/10 transition-colors">
                View All Approvals
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

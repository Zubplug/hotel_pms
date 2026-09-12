'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Activity, ArrowDownRight, ArrowUpRight, Download, FileWarning, RefreshCw } from 'lucide-react';

type DepartmentRevenue = {
  id: string;
  department: string;
  today: number;
  mtd: number;
  ytd: number;
  priorYear: number;
  count: number;
  variance: number;
  isUp: boolean;
};

type RevenueReport = {
  property: { name: string; currency: string };
  businessDate: string;
  snapshot: { today: number; mtd: number; ytd: number; priorYear: number; variance: number; isUp: boolean };
  departments: DepartmentRevenue[];
};

const money = (value: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const pct = (value: number) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;

async function loadRevenue(propertyId: string): Promise<RevenueReport> {
  const response = await fetch(`/api/v1/accountant/revenue?propertyId=${propertyId}`);
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(body.error?.message || body.error || 'Revenue report unavailable');
  return body.data ?? body;
}

export default function RevenueAccountingPage() {
  const { data: session } = useLodgeCoreSession();
  const propertyId = session?.user?.propertyId;
  const reportQuery = useQuery({
    queryKey: ['accountant-revenue', propertyId],
    queryFn: () => loadRevenue(propertyId as string),
    enabled: Boolean(propertyId),
    refetchInterval: 60000,
  });

  const downloadReport = () => {
    if (!reportQuery.data) return;
    const { snapshot, departments, businessDate } = reportQuery.data;
    const rows = [
      ['Department', 'Today', 'MTD', 'YTD', 'Prior year same day', 'Variance'],
      ...departments.map(item => [item.department, item.today, item.mtd, item.ytd, item.priorYear, `${item.variance}%`]),
      ['Total', snapshot.today, snapshot.mtd, snapshot.ytd, snapshot.priorYear, `${snapshot.variance}%`],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `revenue-${businessDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (reportQuery.isLoading) return <div className="flex min-h-full items-center justify-center bg-slate-950"><RefreshCw className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  if (reportQuery.isError || !reportQuery.data) return <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-slate-300"><FileWarning className="h-10 w-10 text-rose-400" /><p>Revenue data could not be loaded.</p><button onClick={() => reportQuery.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"><RefreshCw className="h-4 w-4" />Retry</button></div>;

  const report = reportQuery.data;
  const metrics = [
    ['Today', report.snapshot.today],
    ['Month to date', report.snapshot.mtd],
    ['Year to date', report.snapshot.ytd],
    ['Prior-year same day', report.snapshot.priorYear],
  ];

  return (
    <div className="min-h-full bg-slate-950 p-6 font-sans text-slate-50 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white"><Activity className="h-8 w-8 text-emerald-400" />Revenue Accounting</h1><p className="mt-1 text-sm text-slate-400">{report.property.name} · Live departmental revenue for business date {report.businessDate}.</p></div>
          <button onClick={downloadReport} className="inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"><Download className="h-4 w-4" />Export Report</button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([title, value]) => <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-6"><p className="text-sm font-medium text-slate-400">{title}</p><p className="mt-2 text-3xl font-bold text-white">{money(Number(value), report.property.currency)}</p></div>)}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="border-b border-white/5 p-6"><h2 className="text-lg font-semibold text-white">Revenue Streams</h2><p className="mt-1 text-sm text-slate-400">Departments are derived from the current revenue sources recorded in the database.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-white/5 text-sm uppercase tracking-wider text-slate-300"><th className="border-b border-white/10 px-6 py-4 font-medium">Department</th><th className="border-b border-white/10 px-6 py-4 font-medium">Today</th><th className="border-b border-white/10 px-6 py-4 font-medium">MTD</th><th className="border-b border-white/10 px-6 py-4 font-medium">YTD</th><th className="border-b border-white/10 px-6 py-4 font-medium">Variance (YoY)</th></tr></thead><tbody className="divide-y divide-white/5">{report.departments.length === 0 ? <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No revenue transactions found for this property.</td></tr> : report.departments.map(stream => <tr key={stream.id} className="transition-colors hover:bg-white/5"><td className="px-6 py-4 font-medium text-white">{stream.department}<span className="ml-2 text-xs text-slate-500">{stream.count} charges</span></td><td className="px-6 py-4 text-slate-300">{money(stream.today, report.property.currency)}</td><td className="px-6 py-4 text-slate-300">{money(stream.mtd, report.property.currency)}</td><td className="px-6 py-4 text-slate-300">{money(stream.ytd, report.property.currency)}</td><td className="px-6 py-4"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${stream.isUp ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/20 bg-rose-500/10 text-rose-400'}`}>{stream.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{pct(stream.variance)}</span></td></tr>)}</tbody><tfoot className="border-t border-white/10 bg-white/5 font-medium"><tr><td className="px-6 py-4 text-white">Total</td><td className="px-6 py-4 text-emerald-400">{money(report.snapshot.today, report.property.currency)}</td><td className="px-6 py-4 text-emerald-400">{money(report.snapshot.mtd, report.property.currency)}</td><td className="px-6 py-4 text-emerald-400">{money(report.snapshot.ytd, report.property.currency)}</td><td className="px-6 py-4 text-emerald-400">{pct(report.snapshot.variance)}</td></tr></tfoot></table></div>
        </div>
      </div>
    </div>
  );
}

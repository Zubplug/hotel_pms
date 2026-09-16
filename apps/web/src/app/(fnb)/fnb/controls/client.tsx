'use client';

import { useEffect, useState, useMemo } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, AlertOctagon, TrendingUp, CreditCard, BarChart3, Activity
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function StatCard({ label, value, detail, dotColorClass }: { label: string; value: string | number; detail: string; dotColorClass: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColorClass}`} />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-black text-slate-800 tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-slate-400">{detail}</p>
    </div>
  );
}

export default function FnbDashboardClient({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!session?.user || !propertyId) return;
    
    setLoading(true);
    setError(null);
    fetch(`/api/v1/fnb/controls?propertyId=${propertyId}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load dashboard');
        return body.data;
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, propertyId, refreshToken]);

  // Set up auto-refresh for active monitoring
  useEffect(() => {
    if (!session?.user || !propertyId) return;
    const interval = setInterval(() => setRefreshToken(v => v + 1), 60000);
    return () => clearInterval(interval);
  }, [session, propertyId]);

  const kpis = data?.kpis || {};
  const alerts = data?.alerts || [];
  const topSellingItems = data?.topSellingItems || [];
  const salesBreakdown = data?.salesBreakdown || [];
  const currency = 'NGN'; // Normally from property config

  if (loading && !data) return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50/50">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50/50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-700">{error}</div>
    </div>
  );

  const blockClose = kpis.openOrders > 0 || kpis.openSessions > 0;

  // Sorting alerts by severity
  const sortedAlerts = [...alerts].sort((a, b) => {
    const sevScore = { destructive: 3, warning: 2, info: 1 } as any;
    return (sevScore[b.severity] || 0) - (sevScore[a.severity] || 0);
  });

  const maxQty = Math.max(...topSellingItems.map((i: any) => i.quantitySold), 1);
  const totalPayments = salesBreakdown.reduce((sum: number, p: any) => sum + p.amount, 0);
  const exceptionCount = sortedAlerts.length + Number(kpis.openOrders || 0) + Number(kpis.openSessions || 0);

  return (
    <div className="min-h-screen bg-[#fbf8f6] px-4 pb-16 pt-6 font-sans text-[#24130d] sm:px-6 sm:pt-8 md:px-8">
      <div className="mx-auto max-w-[1540px] space-y-8">

        {/* Header */}
        <PageHeader 
          title="F&B Controls & Audit" 
          description="Real-time exception monitoring, revenue tracking, and day closure blockers."
          actions={
            <Button 
              variant="outline"
              onClick={() => setRefreshToken((v) => v + 1)}
              className="bg-white border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 font-semibold h-10 px-5 rounded-xl"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Control posture</p><p className="mt-3 text-2xl font-bold text-[#24130d]">{exceptionCount ? 'Attention required' : 'Ready to close'}</p><p className="mt-1 text-xs text-[#927b70]">{exceptionCount} active control signal{exceptionCount === 1 ? '' : 's'}</p></div><span className={`rounded-xl p-3 ${exceptionCount ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><Activity className="h-5 w-5" /></span></div></div>
          <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Tender readiness</p><p className="mt-3 text-2xl font-bold text-[#24130d]">{money(totalPayments, currency)}</p><p className="mt-1 text-xs text-[#927b70]">Payments currently collected</p></div><span className="rounded-xl bg-[#f7eee9] p-3 text-[#7c2d12]"><CreditCard className="h-5 w-5" /></span></div></div>
          <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Service pulse</p><p className="mt-3 text-2xl font-bold text-[#24130d]">{kpis.covers || 0} covers</p><p className="mt-1 text-xs text-[#927b70]">{kpis.openOrders || 0} orders · {kpis.openSessions || 0} sessions open</p></div><span className="rounded-xl bg-orange-50 p-3 text-orange-600"><BarChart3 className="h-5 w-5" /></span></div></div>
        </div>

        {/* Audit Readiness Hero */}
        <div className={`relative overflow-hidden rounded-2xl border ${blockClose ? 'bg-white border-amber-200 shadow-sm shadow-amber-900/5' : 'bg-slate-900 border-slate-800 shadow-xl'}`}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            {blockClose ? <AlertTriangle className="w-48 h-48 text-amber-500" /> : <CheckCircle2 className="w-48 h-48 text-emerald-500" />}
          </div>
          <div className="relative p-6 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${blockClose ? 'bg-amber-100 text-amber-700' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {blockClose ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {blockClose ? 'Blockers Active' : 'Ready for Close'}
              </div>
              <h2 className={`mt-4 text-2xl md:text-3xl font-black tracking-tight ${blockClose ? 'text-slate-900' : 'text-white'}`}>
                {blockClose ? `${kpis.openSessions + kpis.openOrders} exceptions require attention.` : 'All F&B controls reconciled.'}
              </h2>
              <p className={`mt-2 text-sm font-medium ${blockClose ? 'text-slate-600' : 'text-slate-400'}`}>
                {blockClose 
                  ? 'Night Audit cannot proceed until these operational exceptions are resolved.' 
                  : 'No active sessions or unclosed orders. Night Audit can proceed normally.'}
              </p>
              
              <div className="mt-6 flex flex-wrap gap-6">
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${blockClose ? 'text-slate-500' : 'text-slate-500'}`}>Open Sessions</span>
                  <span className={`text-xl font-bold ${blockClose ? (kpis.openSessions > 0 ? 'text-amber-600' : 'text-slate-800') : 'text-slate-200'}`}>{kpis.openSessions}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${blockClose ? 'text-slate-500' : 'text-slate-500'}`}>Unclosed Orders</span>
                  <span className={`text-xl font-bold ${blockClose ? (kpis.openOrders > 0 ? 'text-amber-600' : 'text-slate-800') : 'text-slate-200'}`}>{kpis.openOrders}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${blockClose ? 'text-slate-500' : 'text-slate-500'}`}>Total Covers</span>
                  <span className={`text-xl font-bold ${blockClose ? 'text-slate-800' : 'text-slate-200'}`}>{kpis.covers}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* Revenue & Controls */}
          <div>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              Revenue & Controls
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Net F&B Revenue" value={money(kpis.netSales, currency)} detail="Gross - Discounts/Voids" dotColorClass="bg-emerald-500" />
              <StatCard label="Gross Sales" value={money(kpis.grossSales, currency)} detail="Before discounts/comps" dotColorClass="bg-indigo-500" />
              <StatCard label="Discounts" value={money(kpis.discounts, currency)} detail="Applied to orders" dotColorClass="bg-slate-400" />
              <StatCard label="Voids & Comps" value={money(kpis.voidedAmount + kpis.comps, currency)} detail="Total lost revenue" dotColorClass="bg-rose-500" />
            </div>
          </div>

          {/* Cash & Operations */}
          <div>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              Cash & Operations
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Payments Collected" value={money(kpis.paymentsCollected, currency)} detail="Live tender total" dotColorClass="bg-emerald-500" />
              <StatCard label="Refunds" value={money(kpis.refunds, currency)} detail="Returned to guests" dotColorClass="bg-orange-500" />
              <StatCard label="Avg Check" value={money(kpis.averageCheck, currency)} detail="Revenue per cover" dotColorClass="bg-indigo-500" />
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-800" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Active Pipeline</p>
                </div>
                <div className="flex items-end justify-between mt-1">
                  <div>
                    <p className="text-2xl font-black text-slate-800 tabular-nums">{kpis.openOrders}</p>
                    <p className="text-[11px] font-medium text-slate-400">Orders</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800 tabular-nums text-right">{kpis.openSessions}</p>
                    <p className="text-[11px] font-medium text-slate-400 text-right">Sessions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Main Analytics Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Top Selling Items & Payment Breakdown (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Top Selling Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topSellingItems.length === 0 ? (
                  <div className="p-8 text-center text-sm font-medium text-slate-500">No items sold today.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {topSellingItems.map((item: any, idx: number) => (
                      <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 truncate">{item.productName}</span>
                            <span className="text-sm font-black text-slate-700">{money(item.revenue, currency)}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-500 w-16">{item.quantitySold} sold</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full" 
                                style={{ width: `${(item.quantitySold / maxQty) * 100}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-2 font-bold">{item.categoryName}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  Payment Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {salesBreakdown.length === 0 ? (
                  <div className="p-8 text-center text-sm font-medium text-slate-500">No payments collected today.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {salesBreakdown.map((pmt: any, idx: number) => {
                      const pct = totalPayments > 0 ? (pmt.amount / totalPayments) * 100 : 0;
                      return (
                        <li key={idx} className="flex items-center justify-between p-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                              {pmt.method.substring(0, 2)}
                            </div>
                            <span className="font-semibold text-sm text-slate-800">{pmt.method.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-black text-slate-900">{money(pmt.amount, currency)}</span>
                            <span className="text-[11px] font-bold text-slate-400">{pct.toFixed(1)}%</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Operational Exceptions (1/3 width) */}
          <div className="lg:col-span-1">
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl sticky top-24">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <AlertTriangle className="h-4 w-4 text-slate-600" />
                  Exceptions
                </CardTitle>
                {sortedAlerts.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                    {sortedAlerts.length}
                  </span>
                )}
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {sortedAlerts.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">No active exceptions</p>
                    <p className="text-xs text-slate-400 mt-1">Operations are running smoothly.</p>
                  </div>
                ) : (
                  sortedAlerts.map((alert: any, idx: number) => {
                    const isCritical = alert.severity === 'destructive';
                    return (
                      <div key={idx} className={`flex gap-3 rounded-xl border p-4 ${isCritical ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="mt-0.5 shrink-0">
                          {isCritical ? (
                            <AlertOctagon className="h-5 w-5 text-rose-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <h4 className={`text-sm font-black ${isCritical ? 'text-rose-900' : 'text-amber-900'}`}>
                            {alert.title}
                          </h4>
                          <p className={`text-xs font-medium leading-relaxed ${isCritical ? 'text-rose-700/90' : 'text-amber-800/80'}`}>
                            {alert.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

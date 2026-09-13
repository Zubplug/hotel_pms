'use client';

import { useEffect, useState, useMemo } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertTriangle, CheckCircle2, Loader2, Scale, WalletCards, RefreshCw, XCircle, DollarSign, Activity, Users, FileText
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function StatCard({ label, value, detail, accent }: { label: string; value: string | number; detail: string; accent: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[20px] border p-5 ${accent}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-600">{detail}</p>
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
  const currency = 'NGN'; // Normally from property config

  

  if (loading && !data) return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-full px-5 pb-12 pt-8 bg-slate-50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
    </div>
  );

  const blockClose = kpis.openOrders > 0 || kpis.openSessions > 0;

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8 bg-slate-50">
      <div className="mx-auto max-w-[1540px] space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              F&B Audit / Controls
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50"
                style={{ boxShadow: '0 0 24px rgba(99,102,241,0.1)' }}>
                <Scale className="h-5 w-5 text-indigo-600" />
              </span>
              F&B Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Real-time exception monitoring, revenue tracking, and day closure blockers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRefreshToken((v) => v + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* ── Hero status card ── */}
        <section
          className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
          
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-violet-100 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600">Audit Readiness</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Active Business Date
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {kpis.openSessions} open POS sessions
                <span className="mx-1.5 text-slate-700">·</span>
                {kpis.openOrders} unclosed orders
                <span className="mx-1.5 text-slate-700">·</span>
                {kpis.covers} covers recorded
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold ${
              !blockClose
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {!blockClose ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {!blockClose ? 'Ready for Close' : 'Blockers Active'}
            </span>
          </div>
        </section>

        {/* ── Revenue Stat cards ── */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 mt-8">Revenue & Controls</div>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Gross Sales" value={money(kpis.grossSales, currency)} detail="Before discounts/comps" accent="border-indigo-200 bg-indigo-50 text-indigo-700" />
          <StatCard label="Discounts" value={money(kpis.discounts, currency)} detail="Applied to orders" accent="border-slate-200 bg-white text-slate-700" />
          <StatCard label="Complimentary" value={money(kpis.comps, currency)} detail="Staff & Management Comps" accent="border-slate-200 bg-white text-slate-700" />
          <StatCard label="Voids" value={money(kpis.voidedAmount, currency)} detail="Cancelled / Voided items" accent="border-rose-200 bg-rose-50 text-rose-700" />
          <StatCard label="Net F&B Revenue" value={money(kpis.netSales, currency)} detail="Gross - Discounts/Voids" accent="border-emerald-200 bg-emerald-50 text-emerald-700" />
        </section>

        {/* ── Operational Stat cards ── */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 mt-8">Cash & Operations</div>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Payments Collected" value={money(kpis.paymentsCollected, currency)} detail="Live tender total" accent="border-amber-200 bg-amber-50 text-amber-700" />
          <StatCard label="Refunds" value={money(kpis.refunds, currency)} detail="Returned to guests" accent="border-orange-200 bg-orange-50 text-orange-700" />
          <StatCard label="Unclosed Orders" value={kpis.openOrders} detail="SUBMITTED / IN SERVICE" accent={kpis.openOrders > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"} />
          <StatCard label="Open POS Sessions" value={kpis.openSessions} detail="Active tills/cashiers" accent={kpis.openSessions > 0 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"} />
          <StatCard label="Avg Check" value={money(kpis.averageCheck, currency)} detail="Revenue per cover" accent="border-slate-200 bg-slate-50 text-slate-700" />
        </section>

        {/* ── Main grid for exceptions/alerts ── */}
        <section className="grid gap-5 xl:grid-cols-2 mt-8">
          {/* Alerts Box */}
          <div className="overflow-hidden rounded-[20px] border border-slate-200" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <AlertTriangle className="h-4 w-4 text-indigo-600" />
                  Exception Monitoring
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Live operational anomalies affecting audit</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                {alerts.length} ALERTS
              </span>
            </div>
            <div className="p-5 space-y-3">
              {alerts.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center border border-white/[0.04] rounded-xl border-dashed">
                  No active exceptions.
                </div>
              ) : (
                alerts.map((alert: any, idx: number) => {
                  let accent = alert.severity === 'destructive' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700';
                  return (
                    <div key={idx} className={`flex flex-col gap-1 rounded-xl border p-3.5 ${accent}`}>
                      <h4 className="text-xs font-bold">{alert.title}</h4>
                      <p className="text-[11px] opacity-80">{alert.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

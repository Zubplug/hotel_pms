'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Loader2, Utensils,
  Receipt, Wallet, Store, MonitorSmartphone
} from 'lucide-react';
import { format } from 'date-fns';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default function FnbControlPage() {
  const { propertyId } = useProperty();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load F&B audit data');
        return body.data;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading && !data) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={PAGE_BG}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-full px-5 pb-12 pt-8" style={PAGE_BG}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">{error}</div>
    </div>
  );

  const fnb = data?.fnb;
  if (!fnb) return (
    <div className="min-h-full px-5 pb-12 pt-8 text-center text-slate-400" style={PAGE_BG}>
      No F&B data available.
    </div>
  );

  const currency = data?.property?.baseCurrency || 'NGN';
  const businessDate = data?.businessDate || new Date().toISOString();

  // Metrics
  const { metrics, exceptions, outlets, sessions } = fnb;

  const totalExceptions =
    exceptions.openOrders.length +
    exceptions.openSessions.length +
    exceptions.unreviewedVoids.length +
    exceptions.cashVarianceSessions.length;

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8" style={PAGE_BG}>
      <div className="mx-auto max-w-[1540px] space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Night Audit / Controls
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(244,63,94,0.2),rgba(225,29,72,0.15))', boxShadow: '0 0 24px rgba(244,63,94,0.2)' }}>
                <Utensils className="h-5 w-5 text-rose-300" />
              </span>
              F&B Activity
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
              Business Date:
              <span className="font-mono font-bold text-slate-300">{format(new Date(businessDate), 'dd MMM yyyy')}</span>
            </p>
          </div>

          <div className={`flex flex-col items-end rounded-[20px] border px-6 py-4 ${
            totalExceptions > 0 ? 'border-amber-400/25 bg-amber-400/[0.07]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'
          }`}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">F&B Status</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${totalExceptions > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {totalExceptions} <span className="text-base font-semibold">exception{totalExceptions !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </header>

        {/* ── First-Class Metrics ── */}
        <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Net F&B', value: money(metrics.netRevenue, currency), accent: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300' },
            { label: 'Gross Sales', value: money(metrics.grossSales, currency), accent: 'border-slate-600/40 bg-slate-600/10 text-slate-300' },
            { label: 'Payments', value: money(metrics.payments, currency), accent: 'border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300' },
            { label: 'Discounts', value: money(metrics.discounts, currency), accent: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300' },
            { label: 'Comps', value: money(metrics.comps, currency), accent: 'border-rose-400/20 bg-rose-400/[0.07] text-rose-300' },
            { label: 'Variance', value: money(metrics.variance, currency), accent: 'border-orange-400/20 bg-orange-400/[0.07] text-orange-300' },
          ].map(stat => (
            <div key={stat.label} className={`flex flex-col gap-3 rounded-[20px] border p-5 ${stat.accent}`}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* ── Main Grid ── */}
        <section className="grid gap-5 xl:grid-cols-[320px_1fr]">

          {/* AUDIT EXCEPTIONS */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[20px] border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white">Audit Exceptions</p>
              
              <div className="space-y-3">
                {/* Open Orders */}
                <div className={`flex items-center justify-between rounded-xl border p-3 ${exceptions.openOrders.length > 0 ? 'border-rose-400/25 bg-rose-400/[0.08]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2.5">
                    {exceptions.openOrders.length > 0 ? <AlertTriangle className="h-4 w-4 text-rose-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500/50" />}
                    <span className={`text-sm font-semibold ${exceptions.openOrders.length > 0 ? 'text-rose-200' : 'text-slate-500'}`}>
                      {exceptions.openOrders.length} Open Orders
                    </span>
                  </div>
                  {exceptions.openOrders.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Resolve &rarr;</span>}
                </div>

                {/* Open Sessions */}
                <div className={`flex items-center justify-between rounded-xl border p-3 ${exceptions.openSessions.length > 0 ? 'border-amber-400/25 bg-amber-400/[0.08]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2.5">
                    {exceptions.openSessions.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500/50" />}
                    <span className={`text-sm font-semibold ${exceptions.openSessions.length > 0 ? 'text-amber-200' : 'text-slate-500'}`}>
                      {exceptions.openSessions.length} Open POS Session
                    </span>
                  </div>
                  {exceptions.openSessions.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Review &rarr;</span>}
                </div>

                {/* Unreviewed Voids */}
                <div className={`flex items-center justify-between rounded-xl border p-3 ${exceptions.unreviewedVoids.length > 0 ? 'border-amber-400/25 bg-amber-400/[0.08]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2.5">
                    {exceptions.unreviewedVoids.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500/50" />}
                    <span className={`text-sm font-semibold ${exceptions.unreviewedVoids.length > 0 ? 'text-amber-200' : 'text-slate-500'}`}>
                      {exceptions.unreviewedVoids.length} Unreviewed Voids
                    </span>
                  </div>
                  {exceptions.unreviewedVoids.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Review &rarr;</span>}
                </div>

                {/* Cash Variance */}
                <div className={`flex items-center justify-between rounded-xl border p-3 ${exceptions.cashVarianceSessions.length > 0 ? 'border-amber-400/25 bg-amber-400/[0.08]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                  <div className="flex items-center gap-2.5">
                    {exceptions.cashVarianceSessions.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500/50" />}
                    <span className={`text-sm font-semibold ${exceptions.cashVarianceSessions.length > 0 ? 'text-amber-200' : 'text-slate-500'}`}>
                      {exceptions.cashVarianceSessions.length} Cash Variance
                    </span>
                  </div>
                  {exceptions.cashVarianceSessions.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Review &rarr;</span>}
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Tables */}
          <div className="flex flex-col gap-5">
            
            {/* OUTLET RECONCILIATION */}
            <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Store className="h-4 w-4 text-indigo-400" />
                  Outlet Reconciliation
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }} className="border-b border-white/[0.06]">
                      {['Outlet', 'Orders', 'Gross', 'Disc.', 'Comps', 'Net', 'Payments', 'Variance'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {outlets.map((o: any, i: number) => (
                      <tr key={i} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-200">{o.name}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{o.orders}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-300">{money(o.gross, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-amber-400/80">{money(o.discounts, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-rose-400/80">{money(o.comps, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-white">{money(o.net, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-emerald-400/80">{money(o.payments, currency)}</td>
                        <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${Math.abs(o.variance) > 0.01 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {money(o.variance, currency)}
                        </td>
                      </tr>
                    ))}
                    {outlets.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">No outlet activity for this date.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* POS SESSIONS */}
            <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <MonitorSmartphone className="h-4 w-4 text-sky-400" />
                  POS Sessions
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }} className="border-b border-white/[0.06]">
                      {['Cashier', 'Outlet', 'Terminal', 'Opened', 'Closed', 'Expected', 'Actual', 'Variance', 'Status'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${['Expected', 'Actual', 'Variance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sessions.map((s: any) => (
                      <tr key={s.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-200">{s.cashier}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{s.outlet}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{s.terminal}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-400">{s.openedAt ? format(new Date(s.openedAt), 'HH:mm') : '—'}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-400">{s.closedAt ? format(new Date(s.closedAt), 'HH:mm') : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-300">{money(s.expectedCash, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-300">{money(s.actualCash, currency)}</td>
                        <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${Math.abs(s.variance) > 0.01 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {money(s.variance, currency)}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            s.status === 'OPEN' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' :
                            s.status === 'CLOSED' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                            'border-slate-500/30 bg-slate-500/10 text-slate-400'
                          }`}>
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">No POS sessions for this date.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}

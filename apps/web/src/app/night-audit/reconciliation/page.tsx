'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import {
  AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck,
  Loader2, Scale, WalletCards, RefreshCw,
} from 'lucide-react';

type Reconciliation = any;

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[20px] border p-5 ${accent}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-600">{detail}</p>
    </div>
  );
}

function VarianceBadge({ variance }: { variance: number | null }) {
  if (variance === null) return <span className="text-slate-600">—</span>;
  const ok = Math.abs(variance) < 0.01;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
      ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
    }`}>
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {money(variance)}
    </span>
  );
}

export default function ReconciliationPage() {
  const { propertyId } = useProperty();
  const [date, setDate] = useState('');
  const [data, setData] = useState<Reconciliation>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`)
      .then((res) => res.json())
      .then((res) => setDate(String(res.data?.businessDate || new Date().toISOString().slice(0, 10))))
      .catch(() => setDate(new Date().toISOString().slice(0, 10)));
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId || !date) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/night-audit/reconciliation?propertyId=${propertyId}&businessDate=${date}`)
      .then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error?.message || 'Unable to load reconciliation'); return body.data; })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [propertyId, date, refreshToken]);

  const currency = data?.property?.baseCurrency || 'NGN';
  const source = data?.sourceTotals;
  const snapshot = data?.snapshot;
  const isBalanced = data?.variance?.status === 'BALANCED' && data?.ledger?.status === 'BALANCED';
  const paymentTotal = useMemo(() => (data?.payments || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0), [data]);

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

  const TABLE_ROWS: [string, string][] = [
    ['Room Revenue', 'roomRevenue'],
    ['F&B / POS', 'fnbRevenue'],
    ['Other Revenue', 'otherRevenue'],
    ['Taxes', 'taxes'],
    ['Discounts', 'discounts'],
    ['Refunds', 'refunds'],
    ['Gross Revenue', 'grossRevenue'],
    ['Net Revenue', 'netRevenue'],
  ];

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
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(124,58,237,0.15))', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}
              >
                <Scale className="h-5 w-5 text-indigo-300" />
              </span>
              Revenue Reconciliation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Validate posted revenue, payments, and ledger integrity before the business date is closed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-slate-200 outline-none focus:border-indigo-400/50"
            />
            <button
              onClick={() => setRefreshToken((v) => v + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.06] hover:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* ── Hero status card ── */}
        <section
          className="relative overflow-hidden rounded-[24px] border border-white/[0.07] p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.14) 0%,rgba(124,58,237,0.09) 100%)' }}
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-violet-600/10 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">Close Control</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                {data?.property?.name || 'Property'}
                <span className="mx-2 text-slate-600">·</span>
                <span className="font-mono text-indigo-300">{date}</span>
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {data?.audit?.status || 'PENDING'} audit snapshot
                <span className="mx-1.5 text-slate-700">·</span>
                {data?.coverage?.folioItems || 0} folio records
                <span className="mx-1.5 text-slate-700">·</span>
                {data?.coverage?.paidPosOrders || 0} paid POS orders
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold ${
              isBalanced
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : data?.variance?.status === 'NOT_RUN'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
            }`}>
              {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {isBalanced ? 'Reconciled' : data?.variance?.status === 'NOT_RUN' ? 'Snapshot not available' : 'Review required'}
            </span>
          </div>
        </section>

        {/* ── Stat cards ── */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Room Revenue" value={money(source?.roomRevenue, currency)} detail="Posted accommodation charges" accent="border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300" />
          <StatCard label="F&B / POS" value={money(source?.fnbRevenue, currency)} detail="Includes direct paid POS orders" accent="border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300" />
          <StatCard label="Other Revenue" value={money(source?.otherRevenue, currency)} detail="Ancillary and miscellaneous" accent="border-slate-600/40 bg-slate-600/10 text-slate-300" />
          <StatCard label="Gross Revenue" value={money(source?.grossRevenue, currency)} detail="Before discounts and refunds" accent="border-violet-400/20 bg-violet-400/[0.07] text-violet-300" />
          <StatCard label="Payments Captured" value={money(paymentTotal, currency)} detail={`${data?.payments?.length || 0} payment methods`} accent="border-amber-400/20 bg-amber-400/[0.07] text-amber-300" />
        </section>

        {/* ── Main grid ── */}
        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">

          {/* Source vs Snapshot table */}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <ClipboardCheck className="h-4 w-4 text-indigo-400" />
                  Source vs Snapshot
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Live source vs completed audit snapshot.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                {snapshot ? 'Snapshot available' : 'Pending close'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06]">
                    {['Control', 'Source', 'Snapshot', 'Variance'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {TABLE_ROWS.map(([label, key]) => {
                    const variance = snapshot ? Number(source?.[key] || 0) - Number(snapshot?.[key] || 0) : null;
                    return (
                      <tr key={key} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-300">{label}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-white">{money(source?.[key], currency)}</td>
                        <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-500">{snapshot ? money(snapshot[key], currency) : '—'}</td>
                        <td className="px-5 py-3.5 text-right"><VarianceBadge variance={variance} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Payment mix */}
            <div className="rounded-[20px] border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <WalletCards className="h-4 w-4 text-indigo-400" />
                Payment Mix
              </h3>
              <div className="mt-4 space-y-2">
                {(data?.payments || []).length ? data.payments.map((p: any) => (
                  <div key={p.method} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{p.method.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-slate-600">{p.count} transaction{p.count === 1 ? '' : 's'}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white">{money(p.amount, currency)}</span>
                  </div>
                )) : <p className="text-sm text-slate-600">No captured payments for this date.</p>}
              </div>
            </div>

            {/* Ledger control */}
            <div className="rounded-[20px] border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                Ledger Control
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[['Debits', data?.ledger?.debit], ['Credits', data?.ledger?.credit]].map(([lbl, val]) => (
                  <div key={String(lbl)} className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{String(lbl)}</p>
                    <p className="mt-1.5 text-sm font-bold tabular-nums text-white">{money(Number(val), currency)}</p>
                  </div>
                ))}
              </div>
              <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold ${
                data?.ledger?.status === 'BALANCED'
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                  : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
              }`}>
                <span>Ledger status</span>
                <span>{data?.ledger?.status || 'NOT RUN'}</span>
              </div>
              <p className="mt-3 text-[11px] text-slate-600">{data?.ledger?.entryCount || 0} posted journal entries included.</p>
            </div>
          </div>
        </section>

        {/* ── Balance Proof table ── */}
        <section className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Scale className="h-4 w-4 text-indigo-400" />
              Subledger Balance Proof
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Industry-standard proof: Opening balance + daily activity = closing balance.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06]">
                  {['Ledger', 'Opening', 'Activity', 'Expected', 'Actual', 'Variance', 'Status'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data?.balanceProof?.length ? data.balanceProof.map((row: any) => {
                  const isProven = row.status === 'PROVEN';
                  const isUnavail = row.status === 'UNAVAILABLE';
                  return (
                    <tr key={`${row.ledgerType}-${row.accountKey}`} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-white">{row.accountKey.replace(/_/g, ' ')}</p>
                        <p className="mt-0.5 max-w-xs text-[10px] leading-relaxed text-slate-600">{row.resolution}</p>
                      </td>
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-400">{money(row.openingBalance, currency)}</td>
                      <td className="px-5 py-4 text-right">
                        {row.activityDebit > 0 && <p className="text-xs tabular-nums text-slate-300">+{money(row.activityDebit, currency)} DR</p>}
                        {row.activityCredit > 0 && <p className="text-xs tabular-nums text-slate-300">-{money(row.activityCredit, currency)} CR</p>}
                        {row.activityDebit === 0 && row.activityCredit === 0 && <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-400">{money(row.expectedClosing, currency)}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-white">{row.actualClosing !== null ? money(row.actualClosing, currency) : '—'}</td>
                      <td className="px-5 py-4 text-right"><VarianceBadge variance={row.variance} /></td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          isProven ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                          : isUnavail ? 'border-slate-600/30 bg-slate-600/10 text-slate-500'
                          : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                        }`}>
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                      No balance proof data available. Ensure the audit is completed under the enterprise engine.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}

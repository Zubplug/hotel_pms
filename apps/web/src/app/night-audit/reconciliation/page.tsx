'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Loader2, Scale, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Reconciliation = any;

const money = (value: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function Metric({ label, value, detail, tone = 'slate' }: { label: string; value: string; detail: string; tone?: string }) {
  const tones: Record<string, string> = { slate: 'bg-slate-50 text-slate-900', indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700' };
  return <div className={`rounded-2xl border border-slate-200/80 p-4 ${tones[tone] || tones.slate}`}><p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs opacity-70">{detail}</p></div>;
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
    setLoading(true);
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

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (error && !data) return <div className="mx-auto max-w-3xl p-8"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div></div>;

  return <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_28rem)] px-5 pb-12 pt-6 sm:px-8 sm:pt-8">
    <div className="mx-auto max-w-[1540px] space-y-7">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Night audit / Controls</div><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl"><Scale className="h-8 w-8 text-indigo-600" /> Revenue reconciliation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Validate posted revenue, payments, and ledger integrity before the business date is closed.</p></div>
        <div className="flex flex-wrap items-center gap-2"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm" /><Button variant="outline" className="h-10 rounded-xl" onClick={() => setRefreshToken((value) => value + 1)}><Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
      </header>

      <section className="relative overflow-hidden rounded-[28px] bg-[#081226] p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)] sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Close control</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{data?.property?.name || 'Property'} · {date}</h2><p className="mt-2 text-sm text-slate-400">{data?.audit?.status || 'PENDING'} audit snapshot · {data?.coverage?.folioItems || 0} folio records · {data?.coverage?.paidPosOrders || 0} paid POS orders</p></div><div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-semibold ${isBalanced ? 'bg-emerald-400/15 text-emerald-300' : data?.variance?.status === 'NOT_RUN' ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300'}`}>{isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{isBalanced ? 'Reconciled' : data?.variance?.status === 'NOT_RUN' ? 'Snapshot not available' : 'Review required'}</div></div></section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Room revenue" value={money(source?.roomRevenue, currency)} detail="Posted accommodation charges" tone="indigo" /><Metric label="F&B / POS" value={money(source?.fnbRevenue, currency)} detail="Includes direct paid POS orders" tone="emerald" /><Metric label="Other revenue" value={money(source?.otherRevenue, currency)} detail="Ancillary and miscellaneous" /><Metric label="Gross revenue" value={money(source?.grossRevenue, currency)} detail="Before discounts and refunds" tone="indigo" /><Metric label="Payments captured" value={money(paymentTotal, currency)} detail={`${data?.payments?.length || 0} payment methods`} tone="amber" /></section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="flex items-center gap-2 font-semibold text-slate-900"><ClipboardCheck className="h-4 w-4 text-indigo-600" /> Source vs snapshot</h3><p className="mt-1 text-xs text-slate-500">The live source calculation should agree with the completed audit snapshot.</p></div><span className="text-xs font-semibold text-slate-500">{snapshot ? 'Snapshot available' : 'Pending close'}</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-5 py-3">Control</th><th className="px-5 py-3 text-right">Source</th><th className="px-5 py-3 text-right">Snapshot</th><th className="px-5 py-3 text-right">Variance</th></tr></thead><tbody className="divide-y divide-slate-100">{[['Room revenue','roomRevenue'],['F&B / POS','fnbRevenue'],['Other revenue','otherRevenue'],['Taxes','taxes'],['Discounts','discounts'],['Refunds','refunds'],['Gross revenue','grossRevenue'],['Net revenue','netRevenue']].map(([label, key]) => { const variance = snapshot ? Number(source?.[key] || 0) - Number(snapshot?.[key] || 0) : null; return <tr key={key}><td className="px-5 py-3 font-medium text-slate-700">{label}</td><td className="px-5 py-3 text-right font-medium text-slate-900">{money(source?.[key], currency)}</td><td className="px-5 py-3 text-right text-slate-600">{snapshot ? money(snapshot[key], currency) : '—'}</td><td className={`px-5 py-3 text-right font-semibold ${variance === null ? 'text-slate-400' : Math.abs(variance) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance === null ? '—' : money(variance, currency)}</td></tr>; })}</tbody></table></div></div>
        <div className="space-y-6"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"><h3 className="flex items-center gap-2 font-semibold text-slate-900"><WalletCards className="h-4 w-4 text-indigo-600" /> Payment mix</h3><div className="mt-4 space-y-3">{(data?.payments || []).length ? data.payments.map((payment: any) => <div key={payment.method} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><div><p className="text-sm font-semibold text-slate-800">{payment.method.replace(/_/g, ' ')}</p><p className="text-xs text-slate-500">{payment.count} transaction{payment.count === 1 ? '' : 's'}</p></div><span className="text-sm font-semibold text-slate-900">{money(payment.amount, currency)}</span></div>) : <p className="text-sm text-slate-500">No captured payments for this date.</p>}</div></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"><h3 className="flex items-center gap-2 font-semibold text-slate-900"><BarChart3 className="h-4 w-4 text-indigo-600" /> Ledger control</h3><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Debits</p><p className="mt-1 font-semibold text-slate-900">{money(data?.ledger?.debit, currency)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Credits</p><p className="mt-1 font-semibold text-slate-900">{money(data?.ledger?.credit, currency)}</p></div></div><div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${data?.ledger?.status === 'BALANCED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><span>Ledger status</span><span>{data?.ledger?.status || 'NOT RUN'}</span></div><p className="mt-3 text-xs text-slate-500">{data?.ledger?.entryCount || 0} posted journal entries included.</p></div></div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900"><Scale className="h-4 w-4 text-indigo-600" /> Subledger Balance Proof</h3>
            <p className="mt-1 text-xs text-slate-500">Industry-standard proof: Opening balance + daily activity = closing balance.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Ledger</th>
                <th className="px-5 py-3 text-right">Opening</th>
                <th className="px-5 py-3 text-right">Activity</th>
                <th className="px-5 py-3 text-right">Expected</th>
                <th className="px-5 py-3 text-right">Actual</th>
                <th className="px-5 py-3 text-right">Variance</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.balanceProof?.length ? data.balanceProof.map((row: any) => (
                <tr key={`${row.ledgerType}-${row.accountKey}`}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{row.accountKey.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-[10px] text-slate-500 max-w-xs leading-relaxed">{row.resolution}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-600">{money(row.openingBalance, currency)}</td>
                  <td className="px-5 py-4 text-right">
                    {row.activityDebit > 0 ? <p className="text-xs text-slate-700">+{money(row.activityDebit, currency)} DR</p> : null}
                    {row.activityCredit > 0 ? <p className="text-xs text-slate-700">-{money(row.activityCredit, currency)} CR</p> : null}
                    {row.activityDebit === 0 && row.activityCredit === 0 ? <span className="text-slate-400">—</span> : null}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-700">{money(row.expectedClosing, currency)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-900">{row.actualClosing !== null ? money(row.actualClosing, currency) : '—'}</td>
                  <td className={`px-5 py-4 text-right font-semibold ${row.variance === null ? 'text-slate-400' : Math.abs(row.variance) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.variance === null ? '—' : money(row.variance, currency)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${row.status === 'PROVEN' ? 'bg-emerald-50 text-emerald-700' : row.status === 'UNAVAILABLE' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'}`}>
                      {row.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">No balance proof data available. Ensure the audit is completed under the enterprise engine.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>;
}

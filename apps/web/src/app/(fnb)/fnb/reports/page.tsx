'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Store, Box, Calendar, Calculator, Printer, CheckCircle2, AlertTriangle, WalletCards, ClipboardCheck, Scale
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

const pct = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value || 0) / 100);

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[20px] border p-5 ${accent} print:border-slate-200 print:bg-white print:text-black`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums print:text-black">{value}</p>
      <p className="text-[11px] text-slate-600 print:text-slate-500">{detail}</p>
    </div>
  );
}

function VarianceBadge({ variance }: { variance: number | null }) {
  if (variance === null) return <span className="text-slate-500">—</span>;
  const ok = Math.abs(variance) < 0.01;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums print:border-none print:p-0 ${
      ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 print:text-black' : 'border-rose-200 bg-rose-50 text-rose-700 print:text-black'
    }`}>
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {money(variance)}
    </span>
  );
}

export default function FnbReportsPage() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (propertyId) {
      fetch(`/api/v1/fnb/outlets?propertyId=${propertyId}`).then(res => res.json()).then(res => setOutlets(res.data || []));
      fetch(`/api/v1/inventory/warehouses?propertyId=${propertyId}`).then(res => res.json()).then(res => setWarehouses(res.data?.warehouses || []));
      
      const now = new Date();
      setDateRange({
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)
      });
    }
  }, [propertyId]);

  useEffect(() => {
    if (!session?.user || !propertyId || !dateRange.start || !dateRange.end) return;
    setLoading(true);
    setError(null);
    
    let url = `/api/v1/fnb/reports?propertyId=${propertyId}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
    if (selectedOutlet) url += `&outletId=${selectedOutlet}`;
    if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;

    fetch(url)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load reports');
        return body.data.reports;
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, propertyId, dateRange, selectedOutlet, selectedWarehouse, refreshToken]);

  if (loading && !data) return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50/50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-full px-5 pb-12 pt-8 bg-slate-50/50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800 shadow-sm">{error}</div>
    </div>
  );

  const selectedOutletName = selectedOutlet ? outlets.find(o => o.id === selectedOutlet)?.name : 'All Outlets';
  const displayDate = dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} to ${dateRange.end}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, * { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-border { border-color: #e2e8f0 !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e2e8f0; padding-top: 8px; padding-bottom: 8px; }
        }
      `}} />
      <div className="min-h-full bg-slate-50/50 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8 print:bg-white print:p-0 print:m-0">
        <div className="mx-auto max-w-[1540px] space-y-6">

          {/* ── Header ── */}
          <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600 print:hidden">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                F&B Operations / DSS
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl print:text-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50/50 print:hidden text-indigo-600 shadow-sm">
                  <Calculator className="h-5 w-5" />
                </span>
                F&B Reconciliation
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 print:hidden">
                Validate posted departmental revenue, operating statistics, and inventory control.
              </p>
            </div>

            {/* Filters (No print) */}
            <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm">
              <div className="flex items-center gap-2 px-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="h-8 bg-transparent text-sm font-medium text-slate-700 outline-none" />
                <span className="text-slate-400">to</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="h-8 bg-transparent text-sm font-medium text-slate-700 outline-none" />
              </div>
              <div className="h-6 w-px bg-slate-100"></div>
              <div className="flex items-center gap-2 px-3">
                <Store className="h-4 w-4 text-slate-400" />
                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="h-8 bg-transparent text-sm font-medium text-slate-700 outline-none">
                  <option value="">All Outlets</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="h-6 w-px bg-slate-100"></div>
              <div className="flex items-center gap-2 px-3">
                <Box className="h-4 w-4 text-slate-400" />
                <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="h-8 bg-transparent text-sm font-medium text-slate-700 outline-none">
                  <option value="">All Warehouses</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => setRefreshToken(v => v + 1)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border bg-slate-50 px-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100">
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </header>

          {data && (
            <>
              {/* ── Hero status card ── */}
              <section className="relative overflow-hidden rounded-[24px] border border-indigo-100 bg-white p-6 sm:p-8 shadow-sm print:border-none print:p-0 print:shadow-none">
                <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-50 blur-3xl print:hidden" />
                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600 print:hidden">DSS Summary</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 print:text-black">
                      {selectedOutletName}
                      <span className="mx-2 text-slate-300 print:text-black">·</span>
                      <span className="font-mono text-indigo-600 print:text-black">{displayDate}</span>
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {data.statistics.totalChecks} processed checks
                      <span className="mx-1.5 text-slate-300">·</span>
                      {data.tenderBreakdown.reduce((acc: number, t: any) => acc + t.amount, 0) > 0 ? 'Payments captured' : 'No payments captured'}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {data.summary.totalVoids > 0 ? `${money(data.summary.totalVoids)} voided` : 'No voids'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold ${
                    data.summary.netRevenue > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 print:border-none print:p-0 print:text-black'
                      : 'border-slate-200 bg-slate-50 text-slate-600 print:border-none print:p-0 print:text-black'
                  }`}>
                    <CheckCircle2 className="h-4 w-4" />
                    {data.summary.netRevenue > 0 ? 'Active Trade Day' : 'No Trade Data'}
                  </span>
                </div>
              </section>

              {/* ── Stat cards ── */}
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5 print:gap-4">
                <StatCard label="Total Covers" value={String(data.statistics.totalCovers)} detail={`Across ${data.statistics.totalChecks} checks`} accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Average Check" value={money(data.statistics.averageCheck)} detail="Per Table / Order" accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Spend per Cover" value={money(data.statistics.spendPerCover)} detail="Per Guest" accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Net F&B Revenue" value={money(data.summary.netRevenue)} detail="Excl. Taxes & Voids" accent="bg-indigo-50/50 text-indigo-950 border-indigo-100 shadow-sm" />
                <StatCard label="Gross Margin" value={pct(data.profitability.grossMarginPct)} detail={`Actual COGS: ${money(data.profitability.actualCogs)}`} accent="bg-emerald-50/50 text-emerald-950 border-emerald-100 shadow-sm" />
              </section>

              {/* ── Main grid ── */}
              <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr] print:flex print:flex-col print:gap-8">
                
                {/* Source vs Snapshot equivalent (DSS) */}
                <div className="overflow-hidden rounded-[20px] border bg-white shadow-sm print:border-none print:shadow-none">
                  <div className="flex items-center justify-between border-b px-5 py-4 print:border-b">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 print:text-black">
                        <ClipboardCheck className="h-4 w-4 text-indigo-500 print:text-black" />
                        Daily Sales Summary
                      </h3>
                      <p className="mt-0.5 text-[11px] text-slate-500">Gross sales, allowances, and collected taxes.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-slate-50/50 print:bg-white print:border-b">
                          {['Category', 'Gross Sales', 'Allowances', 'Net Revenue'].map((h, i) => (
                            <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ['Food', data.summary.foodGross, data.summary.foodDiscounts, data.summary.foodGross - data.summary.foodDiscounts],
                          ['Beverage', data.summary.bevGross, data.summary.bevDiscounts, data.summary.bevGross - data.summary.bevDiscounts],
                          ['Other F&B', data.summary.otherGross, data.summary.otherDiscounts, data.summary.otherGross - data.summary.otherDiscounts],
                        ].map(([label, gross, disc, net]) => (
                          <tr key={String(label)} className="transition-colors hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 text-sm font-medium text-slate-700 print:text-black">{label}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900 print:text-black">{money(Number(gross))}</td>
                            <td className="px-5 py-3.5 text-right text-sm tabular-nums text-rose-600 print:text-black">{money(Number(disc))}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-slate-900 print:text-black">{money(Number(net))}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/50 border-t-2 border-slate-100 print:bg-white print:border-t-2">
                          <td className="px-5 py-4 text-sm font-bold text-slate-900 print:text-black">Net F&B Revenue</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 print:text-black">{money(data.summary.grossRevenue)}</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-rose-600 print:text-black">{money(data.summary.totalDiscounts)}</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-indigo-700 print:text-black">{money(data.summary.netRevenue)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">+ Taxes Collected</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-600 print:text-black">{money(data.summary.totalTax)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">+ Service Charge</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-600 print:text-black">{money(data.summary.totalServiceCharge)}</td>
                        </tr>
                        <tr className="bg-indigo-50/50 border-t-2 border-indigo-100 print:bg-white print:border-t-2">
                          <td colSpan={3} className="px-5 py-4 text-right text-sm font-bold text-indigo-900 print:text-black">Total Guest Charge</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-indigo-900 print:text-black">{money(data.summary.totalGuestCharge)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                  {/* Payment mix */}
                  <div className="rounded-[20px] border bg-white p-5 shadow-sm print:border-none print:shadow-none">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 print:text-black">
                      <WalletCards className="h-4 w-4 text-indigo-500 print:text-black" />
                      Payment Mix
                    </h3>
                    <div className="mt-4 space-y-2">
                      {(data.tenderBreakdown || []).length ? data.tenderBreakdown.map((p: any) => (
                        <div key={p.method} className="flex items-center justify-between rounded-xl border bg-slate-50/50 px-3 py-2.5 print:border print:bg-white">
                          <p className="text-sm font-semibold text-slate-700 print:text-black">{p.method.replace(/_/g, ' ')}</p>
                          <span className="text-sm font-bold tabular-nums text-slate-900 print:text-black">{money(p.amount)}</span>
                        </div>
                      )) : <p className="text-sm text-slate-500">No captured payments.</p>}
                    </div>
                  </div>

                  {/* COGS Control */}
                  <div className="rounded-[20px] border bg-white p-5 shadow-sm print:border-none print:shadow-none">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 print:text-black">
                      <BarChart3 className="h-4 w-4 text-indigo-500 print:text-black" />
                      Cost of Goods Sold (COGS)
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border bg-slate-50/50 p-3 print:border print:bg-white">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Actual (Depleted)</p>
                        <p className="mt-1.5 text-sm font-bold tabular-nums text-rose-600 print:text-black">{money(data.profitability.actualCogs)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{pct(data.profitability.actualCostPct)} of Net</p>
                      </div>
                      <div className="rounded-xl border bg-slate-50/50 p-3 print:border print:bg-white">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Theoretical</p>
                        <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-700 print:text-black">{money(data.profitability.theoreticalCogs)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{pct(data.profitability.theoreticalCostPct)} of Net</p>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold print:border ${
                      data.profitability.cogsVariance > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-700 print:text-black'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 print:text-black'
                    }`}>
                      <span>COGS Variance</span>
                      <span>{data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Balance Proof equivalent (Inventory Movement) ── */}
              <section className="overflow-hidden rounded-[20px] border bg-white shadow-sm print:border-none print:shadow-none">
                <div className="border-b px-5 py-4 flex justify-between items-center print:border-b">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 print:text-black">
                      <Scale className="h-4 w-4 text-indigo-500 print:text-black" />
                      Stock Ledger Proof
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Industry-standard proof: Opening stock + activity = closing stock.</p>
                  </div>
                  {!selectedWarehouse && (
                    <span className="no-print rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Select Warehouse
                    </span>
                  )}
                </div>
                {selectedWarehouse ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-slate-50/50 print:bg-white print:border-b">
                          {['Stock Item', 'Opening', '+ In', '- Out', '- Sold', '- Waste', 'Adj', 'Expected', 'Actual', 'Variance', 'Status'].map((h, i) => (
                            <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 && i < 10 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.inventoryMovement.map((row: any) => {
                          const isBalanced = row.variance === 0;
                          return (
                            <tr key={row.stockItemId} className="transition-colors hover:bg-slate-50/50">
                              <td className="px-5 py-4">
                                <p className="text-sm font-semibold text-slate-900 print:text-black">{row.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{row.sku} • {row.unitOfMeasure}</p>
                              </td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600 print:text-black">{row.opening}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-emerald-600 print:text-black">{row.receipts + row.transferIn || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-rose-600 print:text-black">{row.transferOut || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-amber-600 font-bold print:text-black">{row.sales || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-rose-600 print:text-black">{row.waste || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-500 print:text-black">{row.adjustments || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-700 font-semibold print:text-black">{row.expectedClosing}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-900 font-bold print:text-black">{row.actualClosing}</td>
                              <td className="px-5 py-4 text-right">
                                <VarianceBadge variance={row.variance} />
                              </td>
                              <td className="px-5 py-4 text-left">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider print:border-none print:p-0 ${
                                  isBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700 print:text-black' : 'border-rose-200 bg-rose-50 text-rose-700 print:text-black'
                                }`}>
                                  {isBalanced ? 'BALANCED' : 'VARIANCE'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {data.inventoryMovement.length === 0 && (
                          <tr>
                            <td colSpan={11} className="px-5 py-8 text-center text-sm text-slate-500">
                              No stock movement recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 text-sm bg-slate-50/30">
                    Please select a warehouse from the filters above to generate the inventory ledger proof.
                  </div>
                )}
              </section>
            </>
          )}

        </div>
      </div>
    </>
  );
}

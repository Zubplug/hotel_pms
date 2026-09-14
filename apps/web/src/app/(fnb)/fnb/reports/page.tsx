'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Store, Box, Calendar, Calculator, Printer, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

const pct = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value || 0) / 100);

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
    <div className="flex min-h-[60vh] items-center justify-center" style={PAGE_BG}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-full px-5 pb-12 pt-8" style={PAGE_BG}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">{error}</div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, * { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-border { border-color: #e2e8f0 !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e2e8f0; }
        }
      `}} />
      <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8 print:bg-white print:p-0 print:m-0" style={PAGE_BG}>
        <div className="mx-auto max-w-[1540px] space-y-6">

          {/* ── Header ── */}
          <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80 print:hidden">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                F&B Enterprise Operations
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl print:text-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/25 print:hidden"
                  style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(124,58,237,0.15))', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}>
                  <Calculator className="h-5 w-5 text-indigo-300" />
                </span>
                Operations Monitor (DSS)
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 print:hidden">
                Authoritative Daily Sales Summary (DSS), operating statistics, and inventory reconciliation.
              </p>
            </div>

            {/* Filters (No print) */}
            <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2">
              <div className="flex items-center gap-2 px-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="h-8 bg-transparent text-sm font-medium text-slate-300 outline-none" />
                <span className="text-slate-600">to</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="h-8 bg-transparent text-sm font-medium text-slate-300 outline-none" />
              </div>
              <div className="h-6 w-px bg-white/[0.1]"></div>
              <div className="flex items-center gap-2 px-3">
                <Store className="h-4 w-4 text-slate-500" />
                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="h-8 bg-transparent text-sm font-medium text-slate-300 outline-none">
                  <option value="" className="text-black">All Outlets</option>
                  {outlets.map(o => <option key={o.id} value={o.id} className="text-black">{o.name}</option>)}
                </select>
              </div>
              <div className="h-6 w-px bg-white/[0.1]"></div>
              <div className="flex items-center gap-2 px-3">
                <Box className="h-4 w-4 text-slate-500" />
                <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="h-8 bg-transparent text-sm font-medium text-slate-300 outline-none">
                  <option value="" className="text-black">All Warehouses</option>
                  {warehouses.map(w => <option key={w.id} value={w.id} className="text-black">{w.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => setRefreshToken(v => v + 1)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.06] hover:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-500/20 hover:text-indigo-200">
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </header>

          {data && (
            <>
              {/* ── Stat cards ── */}
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5 print:gap-4">
                <StatCard label="Total Covers" value={String(data.statistics.totalCovers)} detail={`Across ${data.statistics.totalChecks} checks`} accent="border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300 print-border" />
                <StatCard label="Average Check" value={money(data.statistics.averageCheck)} detail="Per Table / Order" accent="border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300 print-border" />
                <StatCard label="Spend per Cover" value={money(data.statistics.spendPerCover)} detail="Per Guest" accent="border-slate-600/40 bg-slate-600/10 text-slate-300 print-border" />
                <StatCard label="Net F&B Revenue" value={money(data.summary.netRevenue)} detail="Excl. Taxes & Voids" accent="border-violet-400/20 bg-violet-400/[0.07] text-violet-300 print-border" />
                <StatCard label="Gross Profit Margin" value={pct(data.profitability.grossMarginPct)} detail={`Actual COGS: ${money(data.profitability.actualCogs)}`} accent="border-amber-400/20 bg-amber-400/[0.07] text-amber-300 print-border" />
              </section>

              {/* ── Main grid ── */}
              <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr] print:flex print:flex-col print:gap-8">
                
                {/* DSS Table */}
                <div className="overflow-hidden rounded-[20px] border border-white/[0.06] print:border-none print-border" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 print-border">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white print:text-black">
                        <BarChart3 className="h-4 w-4 text-indigo-400 print:text-black" />
                        A. Daily Sales Summary (DSS)
                      </h3>
                      <p className="mt-0.5 text-[11px] text-slate-500">Gross sales, allowances, and collected taxes.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06] print-border">
                          {['Category', 'Gross Sales', 'Allowances', 'Net Revenue'].map((h, i) => (
                            <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {[
                          ['Food', data.summary.foodGross, data.summary.foodDiscounts, data.summary.foodGross - data.summary.foodDiscounts],
                          ['Beverage', data.summary.bevGross, data.summary.bevDiscounts, data.summary.bevGross - data.summary.bevDiscounts],
                          ['Other F&B', data.summary.otherGross, data.summary.otherDiscounts, data.summary.otherGross - data.summary.otherDiscounts],
                        ].map(([label, gross, disc, net]) => (
                          <tr key={String(label)} className="transition-colors hover:bg-white/[0.02]">
                            <td className="px-5 py-3.5 text-sm font-medium text-slate-300 print:text-black">{label}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-white print:text-black">{money(Number(gross))}</td>
                            <td className="px-5 py-3.5 text-right text-sm tabular-nums text-rose-400 print:text-black">{money(Number(disc))}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-white print:text-black">{money(Number(net))}</td>
                          </tr>
                        ))}
                        <tr className="bg-white/[0.02] border-t border-white/[0.1] print-border">
                          <td className="px-5 py-4 text-sm font-bold text-white print:text-black">Net F&B Revenue</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-white print:text-black">{money(data.summary.grossRevenue)}</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-rose-400 print:text-black">{money(data.summary.totalDiscounts)}</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-indigo-300 print:text-black">{money(data.summary.netRevenue)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">+ Taxes Collected</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-400 print:text-black">{money(data.summary.totalTax)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">+ Service Charge</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-400 print:text-black">{money(data.summary.totalServiceCharge)}</td>
                        </tr>
                        <tr className="bg-indigo-500/[0.05] border-t border-indigo-500/20 print-border">
                          <td colSpan={3} className="px-5 py-4 text-right text-sm font-bold text-indigo-200 print:text-black">Total Guest Charge</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-white print:text-black">{money(data.summary.totalGuestCharge)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                  {/* Payment mix */}
                  <div className="rounded-[20px] border border-white/[0.06] p-5 print:border-none print-border" style={{ background: 'rgba(255,255,255,0.025)' }}>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white print:text-black">
                      <Calculator className="h-4 w-4 text-indigo-400 print:text-black" />
                      E. Settlement
                    </h3>
                    <div className="mt-4 space-y-2">
                      {(data.tenderBreakdown || []).length ? data.tenderBreakdown.map((p: any) => (
                        <div key={p.method} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 print-border">
                          <p className="text-sm font-semibold text-slate-200 print:text-black">{p.method.replace(/_/g, ' ')}</p>
                          <span className="text-sm font-bold tabular-nums text-white print:text-black">{money(p.amount)}</span>
                        </div>
                      )) : <p className="text-sm text-slate-600">No captured payments.</p>}
                    </div>
                  </div>

                  {/* COGS & Profitability */}
                  <div className="rounded-[20px] border border-white/[0.06] p-5 print:border-none print-border" style={{ background: 'rgba(255,255,255,0.025)' }}>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white print:text-black">
                      <Store className="h-4 w-4 text-indigo-400 print:text-black" />
                      C. Profitability
                    </h3>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 print-border">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Actual COGS (Depleted)</p>
                        <p className="mt-1.5 text-lg font-bold tabular-nums text-rose-300 print:text-black">{money(data.profitability.actualCogs)}</p>
                        <p className="text-[10px] text-slate-500">{pct(data.profitability.actualCostPct)} of Net Revenue</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 print-border">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Theoretical COGS (Recipe)</p>
                        <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-300 print:text-black">{money(data.profitability.theoreticalCogs)}</p>
                        <p className="text-[10px] text-slate-500">{pct(data.profitability.theoreticalCostPct)} expected</p>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold print-border ${
                      data.profitability.cogsVariance > 0
                        ? 'border-rose-400/25 bg-rose-400/10 text-rose-300 print:text-black'
                        : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300 print:text-black'
                    }`}>
                      <span>COGS Variance</span>
                      <span>{data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Inventory Movement Table ── */}
              <section className="overflow-hidden rounded-[20px] border border-white/[0.06] print:border-none print-border" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="border-b border-white/[0.06] px-5 py-4 flex justify-between items-center print-border">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white print:text-black">
                      <Box className="h-4 w-4 text-indigo-400 print:text-black" />
                      D. Stock Reconciliation
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Operational ledger mapping physical stock to revenue.</p>
                  </div>
                  {!selectedWarehouse && (
                    <span className="no-print rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Select Warehouse
                    </span>
                  )}
                </div>
                {selectedWarehouse ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06] print-border">
                          {['Item', 'Open', '+ In', '- Out', '- Sold', '- Waste', 'Adj', 'Expected', 'Actual', 'Var'].map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.inventoryMovement.map((row: any) => {
                          return (
                            <tr key={row.stockItemId} className="transition-colors hover:bg-white/[0.02]">
                              <td className="px-4 py-3">
                                <p className="text-sm font-semibold text-white print:text-black">{row.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{row.sku} • {row.unitOfMeasure}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-400 print:text-black">{row.opening}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-emerald-400 print:text-black">{row.receipts + row.transferIn || '-'}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-rose-400 print:text-black">{row.transferOut || '-'}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-amber-300 font-bold print:text-black">{row.sales || '-'}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-rose-400 print:text-black">{row.waste || '-'}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500 print:text-black">{row.adjustments || '-'}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-300 font-semibold print:text-black">{row.expectedClosing}</td>
                              <td className="px-4 py-3 text-right text-xs tabular-nums text-white font-bold print:text-black">{row.actualClosing}</td>
                              <td className="px-4 py-3 text-right">
                                <VarianceBadge variance={row.variance} />
                              </td>
                            </tr>
                          );
                        })}
                        {data.inventoryMovement.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-500">
                              No stock movement recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    Please select a warehouse from the filters above to generate the inventory ledger.
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

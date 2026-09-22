'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Store, Box, Calendar, Calculator, Printer, CheckCircle2, AlertTriangle, WalletCards, ClipboardCheck, Scale, ChevronDown, ArrowUpRight, Clock3, CircleDollarSign, Percent, PackageCheck
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

function collectionFromResponse(payload: any, keys: string[]) {
  const body = payload?.data ?? payload;
  if (Array.isArray(body)) return body;
  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

const pct = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value || 0) / 100);

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className={`stat-card flex flex-col gap-3 rounded-[20px] border p-5 ${accent}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-600">{detail}</p>
    </div>
  );
}

function VarianceBadge({ variance }: { variance: number | null }) {
  if (variance === null) return <span className="text-slate-500">—</span>;
  const ok = Math.abs(variance) < 0.01;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
      ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
    }`}>
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {money(variance)}
    </span>
  );
}

// Print specific sub-components
function PrintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 p-4 rounded-lg">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
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

  // Print Mode State
  const [printMode, setPrintMode] = useState<'dss' | 'inventory' | null>(null);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  useEffect(() => {
    if (propertyId) {
      const scope = async () => {
        try {
          const [outletResponse, warehouseResponse] = await Promise.all([
            fetch(`/api/v1/pos/outlets?propertyId=${encodeURIComponent(propertyId)}`),
            fetch(`/api/v1/inventory/warehouses?propertyId=${encodeURIComponent(propertyId)}`),
          ]);
          const [outletBody, warehouseBody] = await Promise.all([
            outletResponse.json(),
            warehouseResponse.json(),
          ]);
          if (!outletResponse.ok) throw new Error(outletBody?.error || 'Unable to load outlets');
          if (!warehouseResponse.ok) throw new Error(warehouseBody?.error || 'Unable to load warehouses');
          setOutlets(collectionFromResponse(outletBody, ['outlets', 'items']));
          setWarehouses(collectionFromResponse(warehouseBody, ['warehouses', 'items']));
        } catch (scopeError) {
          console.error('[FNB Reports] scope loading failed', scopeError);
          setOutlets([]);
          setWarehouses([]);
        }
      };
      void scope();

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

  useEffect(() => {
    if (!propertyId || !dateRange.start || !dateRange.end) return;
    const interval = window.setInterval(() => setRefreshToken(v => v + 1), 60_000);
    return () => window.clearInterval(interval);
  }, [propertyId, dateRange.start, dateRange.end, selectedOutlet, selectedWarehouse]);

  const handlePrint = (mode: 'dss' | 'inventory') => {
    setShowPrintMenu(false);
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 150);
  };

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
  const selectedWarehouseName = selectedWarehouse ? warehouses.find(w => w.id === selectedWarehouse)?.name : 'All Warehouses';
  const displayDate = dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} to ${dateRange.end}`;
  const propertyName = (session?.user as any)?.organizationName || 'Hotel Property';
  const paymentTotal = data?.tenderBreakdown?.reduce((acc: number, tender: any) => acc + Number(tender.amount || 0), 0) || 0;
  const leadingTender = [...(data?.tenderBreakdown || [])].sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const stockVarianceCount = data?.inventoryMovement?.filter((row: any) => Number(row.variance || 0) !== 0).length || 0;
  const cogsVariancePct = data?.summary?.netRevenue > 0 ? (Math.abs(Number(data.profitability.cogsVariance || 0)) / Number(data.summary.netRevenue)) * 100 : 0;

  const shiftDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const setReportPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = shiftDate(0);
    if (preset === 'today') return setDateRange({ start: today, end: today });
    if (preset === 'yesterday') {
      const yesterday = shiftDate(-1);
      return setDateRange({ start: yesterday, end: yesterday });
    }
    const start = new Date();
    start.setDate(start.getDate() - (preset === 'week' ? 6 : 29));
    setDateRange({ start: start.toISOString().slice(0, 10), end: today });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; font-family: 'Inter', system-ui, sans-serif !important; }
          .screen-only { display: none !important; }
          .print-only { display: block !important; padding: 15mm; background: white; color: black; }
          
          /* Utility classes to ensure A4 dimensions and page breaking */
          .page-break-before { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}} />

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── PRINT-ONLY VIEW: PROFESSIONAL A4 REPORT DESIGN       ── */}
      {/* ────────────────────────────────────────────────────────── */}
      
      {printMode === 'dss' && data && (
        <div className="print-only text-slate-900">
          {/* Document Header */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">DAILY SALES SUMMARY</h1>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-widest">{propertyName}</p>
            </div>
            <div className="text-right text-[11px] text-slate-600 space-y-0.5">
              <p><span className="font-semibold text-slate-900">Date Range:</span> {displayDate}</p>
              <p><span className="font-semibold text-slate-900">Outlet:</span> {selectedOutletName}</p>
              <p><span className="font-semibold text-slate-900">Printed:</span> {new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <PrintMetric label="Net Revenue" value={money(data.summary.netRevenue)} />
            <PrintMetric label="Total Covers" value={String(data.statistics.totalCovers)} />
            <PrintMetric label="Average Check" value={money(data.statistics.averageCheck)} />
            <PrintMetric label="Spend / Cover" value={money(data.statistics.spendPerCover)} />
          </div>

          {/* Revenue & Tax Table */}
          <div className="mb-8 avoid-break">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 border-b border-slate-300 pb-2">Revenue Breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-2 text-left font-bold text-slate-700 uppercase text-[10px] tracking-wider w-2/5">Category</th>
                  <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">Gross Sales</th>
                  <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">Allowances</th>
                  <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Food', data.summary.foodGross, data.summary.foodDiscounts, data.summary.foodGross - data.summary.foodDiscounts],
                  ['Beverage', data.summary.bevGross, data.summary.bevDiscounts, data.summary.bevGross - data.summary.bevDiscounts],
                  ['Other F&B', data.summary.otherGross, data.summary.otherDiscounts, data.summary.otherGross - data.summary.otherDiscounts],
                ].map(([label, gross, disc, net]) => (
                  <tr key={String(label)}>
                    <td className="py-2 font-medium text-slate-700">{label}</td>
                    <td className="py-2 text-right tabular-nums text-slate-900">{money(Number(gross))}</td>
                    <td className="py-2 text-right tabular-nums text-rose-600">{money(Number(disc))}</td>
                    <td className="py-2 text-right tabular-nums text-slate-900 font-semibold">{money(Number(net))}</td>
                  </tr>
                ))}
                {/* Subtotals & Taxes */}
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="py-3 font-bold text-slate-900 text-[11px] uppercase tracking-wider">Total Net F&B Revenue</td>
                  <td className="py-3 text-right tabular-nums text-slate-900 font-bold">{money(data.summary.grossRevenue)}</td>
                  <td className="py-3 text-right tabular-nums text-rose-600 font-bold">{money(data.summary.totalDiscounts)}</td>
                  <td className="py-3 text-right tabular-nums text-indigo-700 font-bold">{money(data.summary.netRevenue)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Taxes Collected</td>
                  <td className="py-2 text-right tabular-nums text-slate-700 font-semibold">{money(data.summary.totalTax)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Service Charge</td>
                  <td className="py-2 text-right tabular-nums text-slate-700 font-semibold">{money(data.summary.totalServiceCharge)}</td>
                </tr>
                <tr className="border-t-2 border-slate-900 border-b-4 border-slate-900 border-double">
                  <td colSpan={3} className="py-4 text-right font-bold text-slate-900 uppercase tracking-widest text-xs">Total Guest Charge</td>
                  <td className="py-4 text-right tabular-nums text-slate-900 font-bold text-lg">{money(data.summary.totalGuestCharge)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 avoid-break">
            {/* Tender / Payment Mix */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 border-b border-slate-300 pb-2">Settlement Mix</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left font-bold text-slate-700 uppercase text-[10px] tracking-wider">Payment Method</th>
                    <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.tenderBreakdown || []).length ? data.tenderBreakdown.map((p: any) => (
                    <tr key={p.method}>
                      <td className="py-2 font-medium text-slate-700">{p.method.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-slate-900">{money(p.amount)}</td>
                    </tr>
                  )) : <tr><td colSpan={2} className="py-4 text-center text-slate-500">No captured payments.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* COGS & Profitability */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 border-b border-slate-300 pb-2">Cost of Goods Sold</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left font-bold text-slate-700 uppercase text-[10px] tracking-wider">Metric</th>
                    <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">Amount</th>
                    <th className="py-2 text-right font-bold text-slate-700 uppercase text-[10px] tracking-wider">% of Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 font-medium text-slate-700">Actual COGS (Depleted)</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-rose-700">{money(data.profitability.actualCogs)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{pct(data.profitability.actualCostPct)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium text-slate-700">Theoretical COGS (Recipe)</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-slate-900">{money(data.profitability.theoreticalCogs)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{pct(data.profitability.theoreticalCostPct)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-300">
                    <td className="py-3 font-bold text-slate-900 text-[11px] uppercase tracking-wider">COGS Variance</td>
                    <td className={`py-3 text-right tabular-nums font-bold ${data.profitability.cogsVariance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}
                    </td>
                    <td className="py-3"></td>
                  </tr>
                  <tr className="bg-slate-50 border-t border-b-2 border-slate-900">
                    <td className="py-3 font-bold text-slate-900 text-[11px] uppercase tracking-wider">Gross F&B Margin</td>
                    <td className="py-3 text-right tabular-nums font-bold text-indigo-700">{money(data.summary.netRevenue - data.profitability.actualCogs)}</td>
                    <td className="py-3 text-right tabular-nums font-bold text-indigo-700">{pct(data.profitability.grossMarginPct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {printMode === 'inventory' && data && (
        <div className="print-only text-slate-900">
          <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 landscape; margin: 0; } }`}} />
          
          {/* Document Header */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVENTORY LEDGER PROOF</h1>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-widest">{propertyName}</p>
            </div>
            <div className="text-right text-[11px] text-slate-600 space-y-0.5">
              <p><span className="font-semibold text-slate-900">Date Range:</span> {displayDate}</p>
              <p><span className="font-semibold text-slate-900">Warehouse:</span> {selectedWarehouseName}</p>
              <p><span className="font-semibold text-slate-900">Printed:</span> {new Date().toLocaleString()}</p>
            </div>
          </div>

          {!selectedWarehouse ? (
            <div className="text-center py-10 text-slate-500 font-medium">Please select a warehouse on the screen before printing the inventory ledger.</div>
          ) : (
            <div className="avoid-break">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="py-2 text-left font-bold text-slate-900 uppercase tracking-wider">Stock Item</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Open</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">+In</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Out</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Sold</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Waste</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Adj</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Expected</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Actual</th>
                    <th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.inventoryMovement.map((row: any) => (
                    <tr key={row.stockItemId} className="hover:bg-slate-50">
                      <td className="py-2">
                        <span className="font-bold text-slate-800 block">{row.name}</span>
                        <span className="text-[9px] text-slate-500">{row.sku} • {row.unitOfMeasure}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{row.opening}</td>
                      <td className="py-2 text-right tabular-nums text-slate-900 font-semibold">{row.receipts + row.transferIn || '-'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-900 font-semibold">{row.transferOut || '-'}</td>
                      <td className="py-2 text-right tabular-nums text-rose-700 font-bold">{row.sales || '-'}</td>
                      <td className="py-2 text-right tabular-nums text-amber-700 font-semibold">{row.waste || '-'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{row.adjustments || '-'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-800 font-semibold">{row.expectedClosing}</td>
                      <td className="py-2 text-right tabular-nums text-slate-900 font-bold">{row.actualClosing}</td>
                      <td className={`py-2 text-right tabular-nums font-bold ${row.variance !== 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                        {row.variance !== 0 ? row.variance : 'BALANCED'}
                      </td>
                    </tr>
                  ))}
                  {data.inventoryMovement.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-medium">No stock movement recorded for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── SCREEN-ONLY VIEW: BEAUTIFUL INTERACTIVE DASHBOARD    ── */}
      {/* ────────────────────────────────────────────────────────── */}

      <div className="screen-only fnb-dark-surface min-h-full bg-[#07111f] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8">
        <div className="mx-auto max-w-[1540px] space-y-6">
          {/* ── UI Header ── */}
          <header className="relative z-30 overflow-visible rounded-[28px] bg-[#2b1710] px-6 py-7 text-white shadow-[0_18px_50px_rgba(70,35,20,0.16)] sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#c96f32]/20 blur-3xl" />
            <div>
              <div className="relative mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#edb27c]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#edb27c]" />
                F&B Operations / Reporting
              </div>
              <h1 className="relative flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e39a62]/30 bg-[#c96f32]/20 text-[#f0b783]">
                  <Calculator className="h-5 w-5" />
                </span>
                F&B reporting centre
              </h1>
              <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-[#e8cfc0]">
                Turn posted revenue, guest demand, payment mix, and stock control into a clear manager readout.
              </p>
            </div>

            {/* Filters */}
            <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur-sm">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
                {(['today', 'yesterday', 'week', 'month'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReportPreset(preset)}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {preset === 'week' ? '7 days' : preset === 'month' ? '30 days' : preset}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white px-3">
                <Calendar className="h-4 w-4 text-[#a95524]" />
                <input aria-label="Report start date" type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="h-9 bg-transparent text-sm font-semibold text-[#3b2116] outline-none" />
                <span className="text-[#9a7764]">to</span>
                <input aria-label="Report end date" type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="h-9 bg-transparent text-sm font-semibold text-[#3b2116] outline-none" />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3">
                <Store className="h-4 w-4 text-[#edb27c]" />
                <select aria-label="Outlet scope" value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="h-9 max-w-[170px] bg-transparent text-sm font-semibold text-white outline-none [&>option]:text-[#3b2116]">
                  <option value="">All Outlets</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3">
                <Box className="h-4 w-4 text-[#edb27c]" />
                <select aria-label="Warehouse scope" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="h-9 max-w-[190px] bg-transparent text-sm font-semibold text-white outline-none [&>option]:text-[#3b2116]">
                  <option value="">All Warehouses</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <span className="hidden items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 xl:inline-flex" title="Reports refresh automatically every 60 seconds">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                Live
              </span>
              <button
                onClick={() => setRefreshToken(v => v + 1)}
                aria-label="Refresh report"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Print Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowPrintMenu(!showPrintMenu)} 
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#d98245] px-3 text-sm font-semibold text-white transition-all hover:bg-[#c96f32]"
                >
                  <Printer className="h-4 w-4" /> Print Reports <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
                
                {showPrintMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPrintMenu(false)}></div>
                    <div className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-2xl border border-[#ead7ca] bg-white py-1 text-left shadow-xl">
                      <button onClick={() => handlePrint('dss')} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-[#3b2116] hover:bg-[#fbf1eb]">
                        <ClipboardCheck className="h-4 w-4 text-[#b85f29]" />
                        Daily Sales Summary (DSS)
                      </button>
                      <button onClick={() => handlePrint('inventory')} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-[#3b2116] hover:bg-[#fbf1eb]">
                        <Scale className="h-4 w-4 text-[#b85f29]" />
                        Stock Reconciliation Ledger
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {data && (
            <>
              {/* ── Hero status card ── */}
              <section className="relative overflow-hidden rounded-[24px] border border-[#ead7ca] bg-white p-6 shadow-sm sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#f7e4d5] blur-3xl" />
                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b85f29]">DSS Summary</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                      {selectedOutletName}
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-mono text-[#b85f29]">{displayDate}</span>
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {data.statistics.totalChecks} processed checks
                      <span className="mx-1.5 text-slate-300">·</span>
                      {data.tenderBreakdown.reduce((acc: number, t: any) => acc + t.amount, 0) > 0 ? 'Payments captured' : 'No payments captured'}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {data.summary.totalVoids > 0 ? `${money(data.summary.totalVoids)} voided` : 'No voids'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1"><Clock3 className="h-3 w-3 text-indigo-500" /> Auto refresh 60s</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> {paymentTotal > 0 ? 'Settlement activity present' : 'Awaiting settlement activity'}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold ${
                    data.summary.netRevenue > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}>
                    <CheckCircle2 className="h-4 w-4" />
                    {data.summary.netRevenue > 0 ? 'Active Trade Day' : 'No Trade Data'}
                  </span>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-[22px] border border-[#ead7ca] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Manager readout</p>
                      <h2 className="mt-1 text-lg font-bold tracking-tight text-[#2b1710]">What needs attention today</h2>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ead7ca] bg-[#fbf1eb] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e4927]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#c96f32]" /> Live report scope
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#fbf8f6] p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a7764]">Revenue signal</p>
                      <p className="mt-2 text-sm font-bold text-[#2b1710]">{data.summary.netRevenue > 0 ? 'Trading is active' : 'No posted trade'}</p>
                      <p className="mt-1 text-[11px] text-[#8d7568]">{money(data.summary.netRevenue)} net revenue in scope</p>
                    </div>
                    <div className="rounded-2xl bg-[#fbf8f6] p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a7764]">Margin watch</p>
                      <p className="mt-2 text-sm font-bold text-[#2b1710]">{pct(data.profitability.grossMarginPct)} gross margin</p>
                      <p className="mt-1 text-[11px] text-[#8d7568]">COGS variance {money(data.profitability.cogsVariance)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#fbf8f6] p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a7764]">Control queue</p>
                      <p className="mt-2 text-sm font-bold text-[#2b1710]">{data.summary.totalVoids > 0 ? 'Review void activity' : 'No void escalation'}</p>
                      <p className="mt-1 text-[11px] text-[#8d7568]">{money(data.summary.totalVoids)} void value recorded</p>
                    </div>
                    <div className="rounded-2xl bg-[#fbf8f6] p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a7764]">Settlement signal</p>
                      <p className="mt-2 text-sm font-bold text-[#2b1710]">{leadingTender ? leadingTender.method.replace(/_/g, ' ') : 'No tender data'}</p>
                      <p className="mt-1 text-[11px] text-[#8d7568]">{leadingTender ? `${money(leadingTender.amount)} leading tender` : 'No captured payments in scope'}</p>
                    </div>
                    <div className="rounded-2xl bg-[#fbf8f6] p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a7764]">Stock integrity</p>
                      <p className="mt-2 text-sm font-bold text-[#2b1710]">{stockVarianceCount ? `${stockVarianceCount} variance${stockVarianceCount === 1 ? '' : 's'}` : 'Ledger balanced'}</p>
                      <p className="mt-1 text-[11px] text-[#8d7568]">{selectedWarehouse ? selectedWarehouseName : 'Select a warehouse to prove stock'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#ead7ca] bg-[#2b1710] p-5 text-white shadow-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edb27c]">Scope coverage</p>
                      <h2 className="mt-1 text-lg font-bold">Operational dimensions</h2>
                    </div>
                    <BarChart3 className="h-5 w-5 text-[#edb27c]" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-2xl font-bold">{outlets.length}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#e8cfc0]">Outlets available</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-2xl font-bold">{warehouses.length}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#e8cfc0]">Warehouses available</p></div>
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-[#e8cfc0]">Use the scope controls above to move from the consolidated property view into an outlet or warehouse control view.</p>
                </div>
              </section>

              {/* ── Stat cards ── */}
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Total Covers" value={String(data.statistics.totalCovers)} detail={`Across ${data.statistics.totalChecks} checks`} accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Average Check" value={money(data.statistics.averageCheck)} detail="Per Table / Order" accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Spend per Cover" value={money(data.statistics.spendPerCover)} detail="Per Guest" accent="bg-white text-slate-900 border-slate-200 shadow-sm" />
                <StatCard label="Net F&B Revenue" value={money(data.summary.netRevenue)} detail="Excl. Taxes & Voids" accent="bg-[#fbf1eb] text-[#3b2116] border-[#ead7ca] shadow-sm" />
                <StatCard label="Gross Margin" value={pct(data.profitability.grossMarginPct)} detail={`Actual COGS: ${money(data.profitability.actualCogs)}`} accent="bg-[#f5efe8] text-[#3b2116] border-[#e2d4c8] shadow-sm" />
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-[22px] border border-[#ead7ca] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Revenue engine</p><h3 className="mt-1 text-sm font-bold text-[#2b1710]">Class contribution</h3></div>
                    <CircleDollarSign className="h-5 w-5 text-[#c96f32]" />
                  </div>
                  <div className="mt-5 space-y-3">
                    {[['Food', data.summary.foodGross, '#b85f29'], ['Beverage', data.summary.bevGross, '#d98245'], ['Other', data.summary.otherGross, '#e5b27f']].map(([label, value, color]) => {
                      const share = Number(data.summary.grossRevenue || 0) > 0 ? Number(value || 0) / Number(data.summary.grossRevenue) * 100 : 0;
                      return <div key={String(label)}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-slate-700">{label}</span><span className="font-bold text-slate-900">{share.toFixed(1)}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, share)}%`, backgroundColor: String(color) }} /></div></div>;
                    })}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#ead7ca] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Margin guardrail</p><h3 className="mt-1 text-sm font-bold text-[#2b1710]">Actual vs recipe cost</h3></div>
                    <Percent className="h-5 w-5 text-[#c96f32]" />
                  </div>
                  <div className="mt-5 flex items-end justify-between"><div><p className="text-2xl font-black text-slate-900">{pct(data.profitability.actualCostPct)}</p><p className="mt-1 text-[11px] text-slate-500">Actual cost of net</p></div><div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${data.profitability.cogsVariance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}</div></div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#c96f32]" style={{ width: `${Math.min(100, Number(data.profitability.actualCostPct || 0))}%` }} /></div>
                  <p className="mt-3 text-[11px] text-slate-500">{cogsVariancePct > 0 ? `${cogsVariancePct.toFixed(1)}% of net revenue is outside the recipe cost baseline.` : 'No COGS variance recorded in the selected scope.'}</p>
                </div>
                <div className="rounded-[22px] border border-[#ead7ca] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Control readiness</p><h3 className="mt-1 text-sm font-bold text-[#2b1710]">Closeout signals</h3></div>
                    <PackageCheck className="h-5 w-5 text-[#c96f32]" />
                  </div>
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between"><span className="text-slate-500">Captured tenders</span><span className="font-bold text-slate-900">{money(paymentTotal)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Void exposure</span><span className={`font-bold ${data.summary.totalVoids > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(data.summary.totalVoids)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Stock exceptions</span><span className={`font-bold ${stockVarianceCount ? 'text-rose-600' : 'text-emerald-600'}`}>{stockVarianceCount}</span></div>
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-[#ead7ca] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Revenue composition</p>
                    <h2 className="mt-1 text-lg font-bold tracking-tight text-[#2b1710]">Department contribution</h2>
                  </div>
                  <p className="text-[11px] text-[#8d7568]">Gross revenue before allowances</p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {[
                    ['Food', data.summary.foodGross, 'bg-[#b85f29]'],
                    ['Beverage', data.summary.bevGross, 'bg-[#d98245]'],
                    ['Other F&B', data.summary.otherGross, 'bg-[#e5b27f]'],
                  ].map(([label, value, color]) => {
                    const total = Number(data.summary.grossRevenue || 0);
                    const amount = Number(value || 0);
                    const share = total > 0 ? (amount / total) * 100 : 0;
                    return <div key={String(label)}>
                      <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#4a3024]">{label}</span><span className="font-bold tabular-nums text-[#2b1710]">{money(amount)}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f3e8df]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, share)}%` }} /></div>
                      <p className="mt-1 text-[10px] font-medium text-[#9a7764]">{share.toFixed(1)}% of gross revenue</p>
                    </div>;
                  })}
                </div>
              </section>

              {/* ── Main grid (DSS) ── */}
              <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
                
                <div className="overflow-hidden rounded-[20px] border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b px-5 py-4">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                        Daily Sales Summary
                      </h3>
                      <p className="mt-0.5 text-[11px] text-slate-500">Gross sales, allowances, and collected taxes.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
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
                            <td className="px-5 py-3.5 text-sm font-medium text-slate-700">{label}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">{money(Number(gross))}</td>
                            <td className="px-5 py-3.5 text-right text-sm tabular-nums text-rose-600">{money(Number(disc))}</td>
                            <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-slate-900">{money(Number(net))}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/50 border-t-2 border-slate-100">
                          <td className="px-5 py-4 text-sm font-bold text-slate-900">Net F&B Revenue</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900">{money(data.summary.grossRevenue)}</td>
                          <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-rose-600">{money(data.summary.totalDiscounts)}</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-indigo-700">{money(data.summary.netRevenue)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Taxes Collected</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-600">{money(data.summary.totalTax)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Service Charge</td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-slate-600">{money(data.summary.totalServiceCharge)}</td>
                        </tr>
                        <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                          <td colSpan={3} className="px-5 py-4 text-right text-sm font-bold text-indigo-900">Total Guest Charge</td>
                          <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-indigo-900">{money(data.summary.totalGuestCharge)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                  {/* Payment mix */}
                  <div className="rounded-[20px] border bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <WalletCards className="h-4 w-4 text-indigo-500" />
                      Payment Mix
                    </h3>
                    <div className="mt-4 space-y-2">
                        {(data.tenderBreakdown || []).length ? data.tenderBreakdown.map((p: any) => (
                          <div key={p.method} className="flex items-center justify-between rounded-xl border bg-slate-50/50 px-3 py-2.5">
                            <p className="text-sm font-semibold text-slate-700">{p.method.replace(/_/g, ' ')}</p>
                            <span className="text-sm font-bold tabular-nums text-slate-900">{money(p.amount)}</span>
                          </div>
                        )) : <p className="text-sm text-slate-500">No captured payments.</p>}
                    </div>
                  </div>

                  {/* COGS Control */}
                  <div className="rounded-[20px] border bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Cost of Goods Sold (COGS)
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border bg-slate-50/50 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Actual (Depleted)</p>
                        <p className="mt-1.5 text-sm font-bold tabular-nums text-rose-600">{money(data.profitability.actualCogs)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{pct(data.profitability.actualCostPct)} of Net</p>
                      </div>
                      <div className="rounded-xl border bg-slate-50/50 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Theoretical</p>
                        <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-700">{money(data.profitability.theoreticalCogs)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{pct(data.profitability.theoreticalCostPct)} of Net</p>
                      </div>
                    </div>
                    
                    <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold ${
                      data.profitability.cogsVariance > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      <span>COGS Variance</span>
                      <span>{data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Balance Proof equivalent (Inventory Movement) ── */}
              <section className="overflow-hidden rounded-[20px] border bg-white shadow-sm mt-6">
                <div className="border-b px-5 py-4 flex justify-between items-center">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Scale className="h-4 w-4 text-indigo-500" />
                      Stock Ledger Proof
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Industry-standard proof: Opening stock + activity = closing stock.</p>
                  </div>
                  {!selectedWarehouse && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Select Warehouse
                    </span>
                  )}
                </div>
                {selectedWarehouse ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
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
                                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{row.sku} • {row.unitOfMeasure}</p>
                              </td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600">{row.opening}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-emerald-600">{row.receipts + row.transferIn || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-rose-600">{row.transferOut || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-amber-600 font-bold">{row.sales || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-rose-600">{row.waste || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-500">{row.adjustments || '-'}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-700 font-semibold">{row.expectedClosing}</td>
                              <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-900 font-bold">{row.actualClosing}</td>
                              <td className="px-5 py-4 text-right">
                                <VarianceBadge variance={row.variance} />
                              </td>
                              <td className="px-5 py-4 text-left">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  isBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
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

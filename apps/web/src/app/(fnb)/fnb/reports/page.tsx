'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Store, Calendar, Calculator, Printer, CheckCircle2, AlertTriangle, WalletCards, ClipboardCheck, Scale, ArrowUpRight, Clock3, CircleDollarSign, Percent, PackageCheck, UsersRound, UserRound
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

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  if (variance === null) return <span className="text-slate-500">0</span>;
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
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Print Mode State
  const [printMode, setPrintMode] = useState<'pack' | null>(null);

  useEffect(() => {
    if (propertyId) {
      const scope = async () => {
        try {
          const outletResponse = await fetch(`/api/v1/pos/outlets?propertyId=${encodeURIComponent(propertyId)}`);
          const outletBody = await outletResponse.json();
          if (!outletResponse.ok) throw new Error(outletBody?.error || 'Unable to load outlets');
          const availableOutlets = collectionFromResponse(outletBody, ['outlets', 'items']);
          setOutlets(availableOutlets);
          if (availableOutlets.length === 1) setSelectedOutlet((current) => current || availableOutlets[0].id);
        } catch (scopeError) {
          console.error('[FNB Reports] scope loading failed', scopeError);
          setOutlets([]);
        }
      };
      void scope();

      const now = new Date();
      setDateRange({
        start: localDateString(now),
        end: localDateString(now)
      });
    }
  }, [propertyId]);

  useEffect(() => {
    if (!session?.user || !propertyId || !dateRange.start || !dateRange.end) return;
    setLoading(true);
    setError(null);
    
    let url = `/api/v1/fnb/reports?propertyId=${propertyId}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
    if (selectedOutlet) url += `&outletId=${selectedOutlet}`;

    fetch(url)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Unable to load reports');
        return body.data.reports;
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, propertyId, dateRange, selectedOutlet, refreshToken]);

  useEffect(() => {
    if (!propertyId || !dateRange.start || !dateRange.end) return;
    const interval = window.setInterval(() => setRefreshToken(v => v + 1), 60_000);
    return () => window.clearInterval(interval);
  }, [propertyId, dateRange.start, dateRange.end, selectedOutlet]);

  const handlePrint = () => {
    setPrintMode(null);
    // Print the mounted preview itself so the printed document is identical
    // to the report the manager reviewed in the preview dialog.
    setTimeout(() => {
      window.print();
    }, 500);
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
  const displayDate = dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} to ${dateRange.end}`;
  const reportProperty = data?.property || {};
  const propertyName = reportProperty.name || (session?.user as any)?.organizationName || 'Hotel Property';
  const propertyAddress = reportProperty.address || '';
  const propertyPhone = reportProperty.phone || '';
  const propertyEmail = reportProperty.email || '';
  const paymentTotal = data?.tenderBreakdown?.reduce((acc: number, tender: any) => acc + Number(tender.amount || 0), 0) || 0;
  const leadingTender = [...(data?.tenderBreakdown || [])].sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const stockVarianceCount = data?.inventoryMovement?.filter((row: any) => Number(row.variance || 0) !== 0).length || 0;
  const cogsVariancePct = data?.summary?.netRevenue > 0 ? (Math.abs(Number(data.profitability.cogsVariance || 0)) / Number(data.summary.netRevenue)) * 100 : 0;
  const waiterShiftSummary = data?.waiterShiftSummary || [];
  const outletPaymentSummary = data?.outletPaymentSummary || [];
  const waiterNetSales = waiterShiftSummary.reduce((sum: number, waiter: any) => sum + Number(waiter.netSales || 0), 0);
  const waiterOpenChecks = waiterShiftSummary.reduce((sum: number, waiter: any) => sum + Number(waiter.openChecks || 0), 0);
  const waiterPaymentMethods = Array.from(new Set(waiterShiftSummary.flatMap((waiter: any) => (waiter.tenders || []).map((tender: any) => tender.method)))).sort() as string[];
  const outletPaymentMethods = Array.from(new Set(outletPaymentSummary.flatMap((outlet: any) => (outlet.tenders || []).map((tender: any) => tender.method)))).sort() as string[];
  const paymentMethods = Array.from(new Set([...(data?.tenderBreakdown || []).map((tender: any) => tender.method), ...outletPaymentMethods, ...waiterPaymentMethods])).sort() as string[];
  const inventoryByOutlet: Record<string, any[]> = (data?.inventoryMovement || []).reduce((groups: Record<string, any[]>, row: any) => {
    const groupName = row.outletName || 'Unassigned outlet';
    groups[groupName] = groups[groupName] || [];
    groups[groupName].push(row);
    return groups;
  }, {} as Record<string, any[]>);

  const printDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Open';
  const waiterTenderAmount = (waiter: any, method: string) => Number(waiter.tenders?.find((tender: any) => tender.method === method)?.amount || 0);
  const outletTenderAmount = (outlet: any, method: string) => Number(outlet.tenders?.find((tender: any) => tender.method === method)?.amount || 0);

  const shiftDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateString(date);
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
    setDateRange({ start: localDateString(start), end: today });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          @page { margin: 10mm; size: A4 landscape; }
          html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; font-family: 'Inter', system-ui, sans-serif !important; }
          body * { visibility: hidden !important; }
          /* F&B navigation owns a viewport-height, overflow-hidden shell on screen.
             Release those constraints for printing so Chrome paginates the full report. */
          .fnb-shell, .fnb-shell > main, .fnb-shell > main > div, .fnb-shell > main > div > div { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; padding: 0 !important; background: white !important; }
          .fnb-shell > main > header { display: none !important; }
          .screen-only, .print-only { display: none !important; }
          .report-preview, .report-preview * { visibility: visible !important; }
          /* Keep the printed document visually identical to the reviewed preview.
             Only the modal positioning, scrolling constraint, and controls are removed. */
          .report-preview { display: block !important; position: static !important; width: auto !important; min-height: 0 !important; padding: 4.23mm !important; overflow: visible !important; background: #cbd5e1 !important; color: black; }
          .report-preview-card { display: block !important; position: static !important; width: 230mm !important; max-width: 230mm !important; height: auto !important; max-height: none !important; margin: 0 auto !important; padding: 20px !important; overflow: visible !important; border-radius: 10px !important; box-shadow: none !important; background: #cbd5e1 !important; break-inside: auto !important; page-break-inside: auto !important; }
          .report-preview-body { display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; padding: 12mm !important; background: white !important; break-inside: auto !important; page-break-inside: auto !important; }
          .report-preview-actions { display: none !important; }
          .report-preview .overflow-hidden, .report-preview .overflow-x-auto { overflow: visible !important; }
          .report-preview section, .report-preview .grid, .report-preview table { break-inside: auto !important; page-break-inside: auto !important; }
          table { page-break-inside: auto !important; break-inside: auto !important; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .avoid-break { page-break-inside: auto !important; break-inside: auto !important; }
        }
      `}} />

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── PRINT-ONLY VIEW: PROFESSIONAL A4 REPORT DESIGN       ── */}
      {/* ────────────────────────────────────────────────────────── */}
      
      {printMode === 'pack' && data && (
        <div className="print-only print-page text-slate-900">
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
          <div className="grid grid-cols-5 gap-4 mb-8">
            <PrintMetric label="Net Revenue" value={money(data.summary.netRevenue)} />
            <PrintMetric label="Total Covers" value={String(data.statistics.totalCovers)} />
            <PrintMetric label="Average Check" value={money(data.statistics.averageCheck)} />
            <PrintMetric label="Spend / Cover" value={money(data.statistics.spendPerCover)} />
            <PrintMetric label="Complimentary Food" value={money(data.complimentaryFood?.allocatedAmount || 0)} />
          </div>

          <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50 p-4 avoid-break">
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-900">Complimentary breakfast control</h2>
            <p className="mt-1 text-xs text-orange-800">Room-rate food allocation and actual breakfast redemption activity for the report period.</p>
            <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
              <div><span className="block text-orange-700">Allocated value</span><strong>{money(data.complimentaryFood?.allocatedAmount || 0)}</strong></div>
              <div><span className="block text-orange-700">Allocated covers</span><strong>{data.complimentaryFood?.allocatedCovers || 0}</strong></div>
              <div><span className="block text-orange-700">Redeemed covers</span><strong>{data.complimentaryFood?.redeemedCovers || 0}</strong></div>
              <div><span className="block text-orange-700">POS / buffet</span><strong>{data.complimentaryFood?.posTicketCovers || 0} / {data.complimentaryFood?.buffetBatchCovers || 0}</strong></div>
            </div>
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

      {printMode === 'pack' && data && (
        <div className="print-only print-page text-slate-900">
          
          {/* Document Header */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVENTORY LEDGER PROOF</h1>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-widest">{propertyName}</p>
            </div>
            <div className="text-right text-[11px] text-slate-600 space-y-0.5">
              <p><span className="font-semibold text-slate-900">Date Range:</span> {displayDate}</p>
              <p><span className="font-semibold text-slate-900">Outlet warehouse:</span> {selectedOutletName}</p>
              <p><span className="font-semibold text-slate-900">Printed:</span> {new Date().toLocaleString()}</p>
            </div>
          </div>

          {Object.keys(inventoryByOutlet).length ? Object.entries(inventoryByOutlet).map(([outletName, rows]) => <div key={`print-${outletName}`} className="mb-6 avoid-break">
            <div className="mb-2 border-b border-slate-300 pb-1"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">{outletName}</h2><p className="text-[9px] text-slate-500">{Array.from(new Set(rows.map((row: any) => row.warehouseName))).join(' · ')}</p></div>
            <table className="w-full text-[10px]"><thead><tr className="border-b-2 border-slate-900"><th className="py-2 text-left font-bold text-slate-900 uppercase tracking-wider">Stock Item</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Open</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">+In</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Out</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Sold</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">-Waste</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Adj</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Expected</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Actual</th><th className="py-2 text-right font-bold text-slate-900 uppercase tracking-wider">Variance</th></tr></thead><tbody className="divide-y divide-slate-200">{rows.map((row: any) => <tr key={row.stockItemId}><td className="py-2"><span className="font-bold text-slate-800 block">{row.name}</span><span className="text-[9px] text-slate-500">{row.sku} • {row.unitOfMeasure}</span></td><td className="py-2 text-right tabular-nums text-slate-600">{row.opening}</td><td className="py-2 text-right tabular-nums text-slate-900 font-semibold">{row.receipts + row.transferIn || '-'}</td><td className="py-2 text-right tabular-nums text-slate-900 font-semibold">{row.transferOut || '-'}</td><td className="py-2 text-right tabular-nums text-rose-700 font-bold">{row.sales || '-'}</td><td className="py-2 text-right tabular-nums text-amber-700 font-semibold">{row.waste || '-'}</td><td className="py-2 text-right tabular-nums text-slate-600">{row.adjustments || '-'}</td><td className="py-2 text-right tabular-nums text-slate-800 font-semibold">{row.expectedClosing}</td><td className="py-2 text-right tabular-nums text-slate-900 font-bold">{row.actualClosing}</td><td className={`py-2 text-right tabular-nums font-bold ${row.variance !== 0 ? 'text-rose-700' : 'text-slate-400'}`}>{row.variance !== 0 ? row.variance : 'BALANCED'}</td></tr>)}</tbody></table>
          </div>) : <p className="py-8 text-center text-slate-500">No stock items found for this outlet scope.</p>}
        </div>
      )}

      {printMode === 'pack' && data && (
        <div className="print-only print-page text-slate-900">
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">WAITER POS SHIFT SUMMARY</h1>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-widest">{propertyName}</p>
            </div>
            <div className="text-right text-[11px] text-slate-600 space-y-0.5">
              <p><span className="font-semibold text-slate-900">Date Range:</span> {displayDate}</p>
              <p><span className="font-semibold text-slate-900">Outlet:</span> {selectedOutletName}</p>
              <p><span className="font-semibold text-slate-900">Printed:</span> {new Date().toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-7">
            <PrintMetric label="Waiters in scope" value={String(waiterShiftSummary.length)} />
            <PrintMetric label="Waiter-owned net sales" value={money(waiterNetSales)} />
            <PrintMetric label="Open checks" value={String(waiterOpenChecks)} />
            <PrintMetric label="Total tips" value={money(waiterShiftSummary.reduce((sum: number, waiter: any) => sum + Number(waiter.tips || 0), 0))} />
          </div>
          <table className="w-full text-[9px]">
            <thead>
              <tr className="border-b-2 border-slate-900">
                {['Waiter', 'Outlet', 'Shifts', 'Checks', 'Closed', 'Open', 'Covers', 'Gross', 'Allowances', 'Net Sales', 'Guest Charge', 'Avg Check', ...waiterPaymentMethods.map((method) => method.replace(/_/g, ' ')), 'Tips', 'Voids', 'Shift Status'].map((heading) => (
                  <th key={heading} className="py-2 text-left font-bold text-slate-900 uppercase tracking-wider">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {waiterShiftSummary.map((waiter: any) => (
                <tr key={waiter.staffId || 'unassigned'}>
                  <td className="py-2 font-bold text-slate-900">{waiter.name}</td>
                  <td className="py-2 text-slate-700">{waiter.outletNames?.join(', ') || '0'}</td>
                  <td className="py-2 text-slate-700">{waiter.shiftCount || 0}</td>
                  <td className="py-2 text-slate-700">{waiter.totalChecks}</td>
                  <td className="py-2 text-slate-700">{waiter.closedChecks}</td>
                  <td className="py-2 text-slate-700">{waiter.openChecks}</td>
                  <td className="py-2 text-slate-700">{waiter.covers}</td>
                  <td className="py-2 text-slate-700">{money(waiter.grossSales)}</td>
                  <td className="py-2 text-slate-700">{money(waiter.discounts)}</td>
                  <td className="py-2 font-bold text-slate-900">{money(waiter.netSales)}</td>
                  <td className="py-2 text-slate-700">{money(waiter.guestCharge)}</td>
                  <td className="py-2 text-slate-700">{money(waiter.averageCheck)}</td>
                  {waiterPaymentMethods.map((method) => <td key={method} className="py-2 text-slate-700">{money(waiterTenderAmount(waiter, method))}</td>)}
                  <td className="py-2 text-slate-700">{money(waiter.tips)}</td>
                  <td className="py-2 text-slate-700">{waiter.voids}</td>
                  <td className="py-2 text-slate-700">{waiter.shiftStatuses?.join(', ') || '0'}</td>
                </tr>
              ))}
              {!waiterShiftSummary.length && <tr><td colSpan={15 + waiterPaymentMethods.length} className="py-8 text-center text-slate-500">No waiter-assigned POS activity in this scope.</td></tr>}
            </tbody>
          </table>
          <div className="mt-8">
            <h2 className="mb-3 border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wider text-slate-900">Shift and payment detail by waiter</h2>
            <div className="grid grid-cols-2 gap-4">
              {waiterShiftSummary.map((waiter: any) => (
                <div key={`detail-${waiter.staffId || 'unassigned'}`} className="avoid-break rounded-lg border border-slate-300 p-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div><h3 className="font-bold text-slate-900">{waiter.name}</h3><p className="mt-0.5 text-[10px] text-slate-500">{waiter.position || 'Waiter'} · {waiter.outletNames?.join(', ') || 'No outlet recorded'}</p></div>
                    <span className="text-right text-[10px] font-bold text-slate-700">{money(waiter.netSales)}<br /><span className="font-normal text-slate-500">net sales</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-3 text-[10px]">
                    <div><p className="text-slate-500">Gross</p><p className="font-bold text-slate-900">{money(waiter.grossSales)}</p></div>
                    <div><p className="text-slate-500">Guest charge</p><p className="font-bold text-slate-900">{money(waiter.guestCharge)}</p></div>
                    <div><p className="text-slate-500">Tips</p><p className="font-bold text-slate-900">{money(waiter.tips)}</p></div>
                  </div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Payments</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-slate-200 pb-3 text-[10px]">
                    {waiterPaymentMethods.map((method) => <div key={`detail-${waiter.staffId}-${method}`} className="flex justify-between gap-2"><span className="text-slate-600">{method.replace(/_/g, ' ')}</span><span className="font-bold text-slate-900">{money(waiterTenderAmount(waiter, method))}</span></div>)}
                    {!waiterPaymentMethods.length && <span className="text-slate-500">No captured payments</span>}
                  </div>
                  <p className="mb-1 mt-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">Linked POS shifts</p>
                  {(waiter.shiftDetails || []).length ? <table className="w-full text-[9px]"><thead><tr className="border-b border-slate-200"><th className="py-1 text-left text-slate-500">Opened</th><th className="py-1 text-left text-slate-500">Closed</th><th className="py-1 text-left text-slate-500">Status</th></tr></thead><tbody>{waiter.shiftDetails.map((shift: any) => <tr key={shift.id}><td className="py-1 text-slate-700">{printDateTime(shift.openedAt)}</td><td className="py-1 text-slate-700">{printDateTime(shift.closedAt)}</td><td className="py-1 font-semibold text-slate-900">{shift.controlStatus || shift.status}</td></tr>)}</tbody></table> : <p className="text-[10px] text-slate-500">No linked POS session recorded.</p>}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-[10px] text-slate-500">Source: live POS orders, POS sessions, and POS payment records. Open checks and voids remain visible for manager follow-up.</p>
        </div>
      )}

      {showReportPreview && data && (
        <div className="report-preview fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="report-preview-card flex h-[94vh] max-h-[94vh] w-full max-w-[230mm] flex-col overflow-hidden rounded-[10px] bg-slate-300 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:p-5">
            <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2b1710] text-white shadow-sm">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">Food & beverage operations</p>
                    <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{propertyName}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Daily F&B outlet control report</p>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                      {[propertyAddress, propertyPhone, propertyEmail].filter(Boolean).join('  ·  ') || 'Property contact details not configured'}
                    </p>
                  </div>
                </div>
                <div className="min-w-[180px] text-left text-xs sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Management report</p>
                  <p className="mt-2 font-semibold text-slate-900">{selectedOutletName}</p>
                  <p className="mt-1 text-slate-500">Period: {displayDate}</p>
                  <p className="mt-1 text-slate-500">Prepared: {new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">DSS · waiter shifts · outlet stock reconciliation · complimentary food</p>
                <div className="report-preview-actions flex items-center gap-2">
                  <button type="button" onClick={() => setShowReportPreview(false)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                  <button type="button" onClick={handlePrint} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#c96f32] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#b85f29]"><Printer className="h-4 w-4" /> Print report</button>
                </div>
              </div>
            </div>
            <div className="report-preview-body min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-[10mm] sm:p-[12mm]">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Daily sales summary</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(data.summary.netRevenue)}</p><p className="mt-1 text-xs text-slate-600">{data.statistics.totalChecks} checks · {data.statistics.totalCovers} covers</p></div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Waiter shift summary</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(waiterNetSales)}</p><p className="mt-1 text-xs text-slate-600">{waiterShiftSummary.length} waiters · {waiterOpenChecks} open checks</p></div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Outlet stock ledger</p><p className="mt-2 text-2xl font-bold text-slate-900">{stockVarianceCount}</p><p className="mt-1 text-xs text-slate-600">stock variance lines in the selected outlet</p></div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Complimentary food</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(data.complimentaryFood?.allocatedAmount || 0)}</p><p className="mt-1 text-xs text-slate-600">{data.complimentaryFood?.redeemedCovers || 0} covers redeemed</p></div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><ClipboardCheck className="h-4 w-4 text-indigo-500" /><h3 className="font-bold text-slate-900">Daily Sales Summary</h3></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <PrintMetric label="Gross revenue" value={money(data.summary.grossRevenue)} />
                    <PrintMetric label="Net revenue" value={money(data.summary.netRevenue)} />
                    <PrintMetric label="Actual COGS" value={money(data.profitability.actualCogs)} />
                    <PrintMetric label="Gross margin" value={pct(data.profitability.grossMarginPct)} />
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><UsersRound className="h-4 w-4 text-violet-500" /><h3 className="font-bold text-slate-900">Waiter shifts</h3></div>
                  <div className="mt-4 space-y-2">{waiterShiftSummary.slice(0, 5).map((waiter: any) => <div key={waiter.staffId || waiter.name} className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-700">{waiter.name}</span><span className="shrink-0 font-bold tabular-nums text-slate-900">{money(waiter.netSales)}</span></div>)}{!waiterShiftSummary.length && <p className="text-sm text-slate-500">No waiter shifts in scope.</p>}</div>
                </section>
              </div>
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-[#b85f29]" /><h3 className="font-bold text-slate-900">Payment control summary</h3></div><p className="mt-1 text-xs text-slate-500">Reconcile captured tenders by outlet and waiter for the selected report period.</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{money(paymentTotal)} captured</span>
                </div>
                <div className="mt-4 grid gap-5 xl:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">By outlet</p>
                    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[10px]"><thead><tr className="border-b border-slate-200">{['Outlet', 'Checks', 'Net sales', ...paymentMethods.map((method) => method.replace(/_/g, ' '))].map((heading) => <th key={heading} className="px-2 py-2 font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{outletPaymentSummary.map((outlet: any) => <tr key={outlet.outletId || outlet.outletName}><td className="px-2 py-2 font-semibold text-slate-800">{outlet.outletName}</td><td className="px-2 py-2 tabular-nums text-slate-600">{outlet.checks}</td><td className="px-2 py-2 font-bold tabular-nums text-slate-900">{money(outlet.netSales)}</td>{paymentMethods.map((method) => <td key={`${outlet.outletName}-${method}`} className="px-2 py-2 tabular-nums text-slate-700">{money(outletTenderAmount(outlet, method))}</td>)}</tr>)}{!outletPaymentSummary.length && <tr><td colSpan={3 + paymentMethods.length} className="px-2 py-4 text-center text-slate-500">No outlet payments captured.</td></tr>}</tbody></table></div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">By waiter</p>
                    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[10px]"><thead><tr className="border-b border-slate-200">{['Waiter', 'Outlet', 'Checks', 'Net sales', ...paymentMethods.map((method) => method.replace(/_/g, ' '))].map((heading) => <th key={heading} className="px-2 py-2 font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{waiterShiftSummary.map((waiter: any) => <tr key={waiter.staffId || waiter.name}><td className="px-2 py-2 font-semibold text-slate-800">{waiter.name}</td><td className="px-2 py-2 text-slate-600">{waiter.outletNames?.join(', ') || '0'}</td><td className="px-2 py-2 tabular-nums text-slate-600">{waiter.totalChecks}</td><td className="px-2 py-2 font-bold tabular-nums text-slate-900">{money(waiter.netSales)}</td>{paymentMethods.map((method) => <td key={`${waiter.staffId || waiter.name}-${method}`} className="px-2 py-2 tabular-nums text-slate-700">{money(waiterTenderAmount(waiter, method))}</td>)}</tr>)}{!waiterShiftSummary.length && <tr><td colSpan={4 + paymentMethods.length} className="px-2 py-4 text-center text-slate-500">No waiter payments captured.</td></tr>}</tbody></table></div>
                  </div>
                </div>
              </section>
              <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Scale className="h-4 w-4 text-emerald-600" /><div><h3 className="font-bold text-slate-900">Outlet stock reconciliation</h3><p className="mt-0.5 text-xs text-slate-500">The selected outlet automatically supplies the warehouse scope.</p></div></div>
                {Object.keys(inventoryByOutlet).length ? Object.entries(inventoryByOutlet).map(([outletName, rows]) => <div key={outletName} className="border-b border-slate-200 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-5 py-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-800">{outletName}</p><p className="mt-0.5 text-[10px] text-slate-500">{Array.from(new Set(rows.map((row: any) => row.warehouseName))).join(' · ')}</p></div><span className="text-[10px] font-semibold text-slate-500">{rows.length} stock item{rows.length === 1 ? '' : 's'}</span></div>
                  <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-white"><tr>{['Stock item', 'Opening', 'In', 'Sold', 'Waste', 'Actual', 'Variance'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row: any) => <tr key={row.stockItemId}><td className="px-5 py-3 font-semibold text-slate-800">{row.name}<span className="ml-1 text-[10px] font-normal text-slate-500">{row.unitOfMeasure}</span></td><td className="px-5 py-3 tabular-nums text-slate-600">{row.opening ?? 0}</td><td className="px-5 py-3 tabular-nums text-emerald-600">{Number(row.receipts || 0) + Number(row.transferIn || 0)}</td><td className="px-5 py-3 tabular-nums text-amber-600">{row.sales ?? 0}</td><td className="px-5 py-3 tabular-nums text-rose-600">{row.waste ?? 0}</td><td className="px-5 py-3 tabular-nums font-bold text-slate-900">{row.actualClosing ?? 0}</td><td className="px-5 py-3"><VarianceBadge variance={row.variance} /></td></tr>)}</tbody></table></div>
                </div>) : <div className="p-12 text-center text-sm text-slate-500">No stock items found for this outlet scope.</div>}
              </section>
              <section className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h3 className="font-bold text-orange-950">Complimentary breakfast activity</h3><p className="mt-1 text-xs text-orange-800">Included in the merged pack as F&B allocation, separate from paid POS revenue.</p></div>
                  <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-700">Room allocation + redemption</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <PrintMetric label="Allocated value" value={money(data.complimentaryFood?.allocatedAmount || 0)} />
                  <PrintMetric label="Allocated covers" value={String(data.complimentaryFood?.allocatedCovers || 0)} />
                  <PrintMetric label="Redeemed covers" value={String(data.complimentaryFood?.redeemedCovers || 0)} />
                  <PrintMetric label="POS / buffet" value={`${data.complimentaryFood?.posTicketCovers || 0} / ${data.complimentaryFood?.buffetBatchCovers || 0}`} />
                </div>
              </section>
            </div>
          </div>
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
              
              <button
                onClick={() => setShowReportPreview(true)}
                disabled={!data}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#d98245] px-3 text-sm font-semibold text-white transition-all hover:bg-[#c96f32] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> Preview report pack
              </button>
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
                      <p className="mt-1 text-[11px] text-[#8d7568]">{selectedOutlet ? `${selectedOutletName} outlet warehouse` : 'All authorized outlet warehouses'}</p>
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
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-2xl font-bold">{selectedOutlet ? '1' : '0'}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#e8cfc0]">Outlet stock ledger</p></div>
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-[#e8cfc0]">The selected outlet automatically determines its linked stock warehouse for the merged report pack.</p>
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

              <section className="overflow-hidden rounded-[22px] border border-[#ead7ca] bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-[#ead7ca] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b85f29]">POS shift control</p>
                    <h2 className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight text-[#2b1710]"><UsersRound className="h-5 w-5 text-[#c96f32]" /> Waiter staff summary</h2>
                    <p className="mt-1 text-[11px] text-[#8d7568]">Sales ownership, shift status, settlement mix, and open checks for the selected report scope.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="rounded-full border border-[#ead7ca] bg-[#fbf1eb] px-3 py-1.5 text-[#8e4927]">{waiterShiftSummary.length} staff in scope</span>
                    <span className={`rounded-full border px-3 py-1.5 ${waiterOpenChecks ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{waiterOpenChecks} open checks</span>
                  </div>
                </div>
                {waiterShiftSummary.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
                          {['Waiter / outlet', 'Shift control', 'Checks / covers', 'Net sales', 'Avg check', 'Settlement mix', 'Tips', 'Control'].map((heading) => (
                            <th key={heading} className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {waiterShiftSummary.map((waiter: any) => {
                          const isUnassigned = !waiter.staffId;
                          const open = Number(waiter.openChecks || 0) > 0;
                          const topTender = [...(waiter.tenders || [])].sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))[0];
                          return (
                            <tr key={waiter.staffId || 'unassigned'} className="transition-colors hover:bg-slate-50/50">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isUnassigned ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}><UserRound className="h-4 w-4" /></span>
                                  <div><p className="text-sm font-bold text-slate-900">{waiter.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{waiter.outletNames?.join(', ') || 'No outlet recorded'}{waiter.employeeId ? ` · ${waiter.employeeId}` : ''}</p></div>
                                </div>
                              </td>
                              <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${open ? 'bg-amber-400' : 'bg-emerald-400'}`} /><div><p className="text-xs font-bold text-slate-900">{waiter.shiftCount || 0} shift{waiter.shiftCount === 1 ? '' : 's'}</p><p className="mt-0.5 text-[10px] text-slate-500">{waiter.shiftStatuses?.join(', ') || 'No session status'}</p></div></div></td>
                              <td className="px-5 py-4"><p className="text-sm font-bold tabular-nums text-slate-900">{waiter.closedChecks} / {waiter.totalChecks}</p><p className="mt-0.5 text-[10px] text-slate-500">{waiter.covers} covers · {waiter.openChecks} open</p></td>
                              <td className="px-5 py-4"><p className="text-sm font-bold tabular-nums text-slate-900">{money(waiter.netSales)}</p><p className="mt-0.5 text-[10px] text-slate-500">{money(waiter.discounts)} allowances</p></td>
                              <td className="px-5 py-4 text-sm font-bold tabular-nums text-slate-900">{money(waiter.averageCheck)}</td>
                              <td className="px-5 py-4"><p className="text-xs font-bold uppercase text-slate-700">{topTender ? topTender.method.replace(/_/g, ' ') : '0'}</p><p className="mt-0.5 text-[10px] text-slate-500">{topTender ? money(topTender.amount) : 'No captured tender'}</p></td>
                              <td className="px-5 py-4 text-sm font-bold tabular-nums text-emerald-600">{money(waiter.tips)}</td>
                              <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${waiter.voids > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : open ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{waiter.voids > 0 ? `${waiter.voids} void${waiter.voids === 1 ? '' : 's'}` : open ? 'Open checks' : 'Clear'}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center"><UsersRound className="h-7 w-7 text-slate-400" /><p className="text-sm font-semibold text-slate-600">No waiter-assigned POS activity in this scope.</p><p className="text-xs text-slate-500">Orders without a server assignment will appear as an unassigned control once posted.</p></div>
                )}
                {waiterShiftSummary.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ead7ca] bg-slate-50/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Waiter-owned net sales reconcile to {money(waiterNetSales)}</span><span>Source: live POS orders and payment records</span></div>}
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

            </>
          )}
        </div>
      </div>
    </>
  );
}

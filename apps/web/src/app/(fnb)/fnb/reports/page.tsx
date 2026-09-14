'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Download, RefreshCcw, Loader2, ArrowUpRight, ArrowDownRight, Store, Box, Calendar, Calculator, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

const pct = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value || 0) / 100);

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

  useEffect(() => {
    if (propertyId) {
      // Fetch outlets and warehouses for filters
      fetch(`/api/v1/fnb/outlets?propertyId=${propertyId}`).then(res => res.json()).then(res => setOutlets(res.data || []));
      fetch(`/api/v1/inventory/warehouses?propertyId=${propertyId}`).then(res => res.json()).then(res => setWarehouses(res.data?.warehouses || []));
      
      const now = new Date();
      setDateRange({
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)
      });
    }
  }, [propertyId]);

  const fetchReports = () => {
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
  };

  useEffect(() => {
    fetchReports();
  }, [session, propertyId, dateRange, selectedOutlet, selectedWarehouse]);

  const StatCard = ({ title, value, icon: Icon, subtitle, className = '' }: any) => (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50/50 p-6 md:p-8 space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator className="h-7 w-7 text-indigo-600" />
            F&B Operations Report
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Authoritative Daily Sales Summary (DSS), operating statistics, and inventory reconciliation.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-sm border-none bg-transparent outline-none font-medium text-slate-700" />
            <span className="text-slate-400">to</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-sm border-none bg-transparent outline-none font-medium text-slate-700" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <Store className="h-4 w-4 text-slate-400" />
            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="text-sm border-none bg-transparent outline-none font-medium text-slate-700">
              <option value="">All Outlets</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Box className="h-4 w-4 text-slate-400" />
            <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} className="text-sm border-none bg-transparent outline-none font-medium text-slate-700">
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <Button onClick={fetchReports} disabled={loading} size="sm" className="ml-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Update
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : data && (
        <div className="space-y-8">
          
          {/* ── Section A & B: DSS & Operating Stats ── */}
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            {/* DSS */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b px-6 py-4">
                <h2 className="text-lg font-bold text-slate-800">A. Daily Sales Summary</h2>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-slate-500">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Category</th>
                      <th className="px-6 py-3 text-right font-semibold">Gross Sales</th>
                      <th className="px-6 py-3 text-right font-semibold">Discounts</th>
                      <th className="px-6 py-3 text-right font-semibold">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-6 py-4 font-medium text-slate-700">Food</td>
                      <td className="px-6 py-4 text-right font-mono">{money(data.summary.foodGross)}</td>
                      <td className="px-6 py-4 text-right text-red-600 font-mono">- {money(data.summary.foodDiscounts)}</td>
                      <td className="px-6 py-4 text-right font-bold font-mono">{money(data.summary.foodGross - data.summary.foodDiscounts)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-slate-700">Beverage</td>
                      <td className="px-6 py-4 text-right font-mono">{money(data.summary.bevGross)}</td>
                      <td className="px-6 py-4 text-right text-red-600 font-mono">- {money(data.summary.bevDiscounts)}</td>
                      <td className="px-6 py-4 text-right font-bold font-mono">{money(data.summary.bevGross - data.summary.bevDiscounts)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-slate-700">Other F&B</td>
                      <td className="px-6 py-4 text-right font-mono">{money(data.summary.otherGross)}</td>
                      <td className="px-6 py-4 text-right text-red-600 font-mono">- {money(data.summary.otherDiscounts)}</td>
                      <td className="px-6 py-4 text-right font-bold font-mono">{money(data.summary.otherGross - data.summary.otherDiscounts)}</td>
                    </tr>
                    <tr className="bg-slate-50/50 border-t-2 border-slate-200">
                      <td className="px-6 py-4 font-bold text-slate-900">Net F&B Revenue</td>
                      <td className="px-6 py-4 text-right font-bold font-mono text-slate-900">{money(data.summary.grossRevenue)}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600 font-mono">- {money(data.summary.totalDiscounts)}</td>
                      <td className="px-6 py-4 text-right font-bold font-mono text-indigo-700 text-lg">{money(data.summary.netRevenue)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right font-medium text-slate-500">+ Taxes</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-700">{money(data.summary.totalTax)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right font-medium text-slate-500">+ Service Charge</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-700">{money(data.summary.totalServiceCharge)}</td>
                    </tr>
                    <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                      <td colSpan={3} className="px-6 py-4 text-right font-bold text-indigo-900">Total Guest Charge</td>
                      <td className="px-6 py-4 text-right font-bold font-mono text-indigo-900 text-lg">{money(data.summary.totalGuestCharge)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-amber-50/50 px-6 py-3 border-t flex justify-between text-sm">
                <span className="text-amber-700 font-medium">Informational: Voided/Cancelled Orders</span>
                <span className="font-mono text-amber-700 font-bold">{money(data.summary.totalVoids)}</span>
              </div>
            </div>

            {/* Operating Stats */}
            <div className="space-y-6">
              <StatCard title="B. Operating Stats" value={`${data.statistics.totalCovers} Covers`} subtitle={`Across ${data.statistics.totalChecks} checks`} icon={BarChart3} className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-none shadow-md [&_h3]:text-indigo-100 [&_p]:text-white [&_svg]:text-indigo-200" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Check</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{money(data.statistics.averageCheck)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Per Order</p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Spend / Cover</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{money(data.statistics.spendPerCover)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Per Guest</p>
                </div>
              </div>

              {/* Tenders */}
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-800">E. Settlement (Tender)</h3>
                </div>
                <div className="p-4 space-y-3">
                  {data.tenderBreakdown.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-2">No settlements</p>
                  ) : (
                    data.tenderBreakdown.map((t: any) => (
                      <div key={t.method} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700">{t.method.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-bold text-slate-900">{money(t.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section C: Profitability ── */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">C. Profitability & COGS</h2>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold tracking-wide">
                Margin: {pct(data.profitability.grossMarginPct)}
              </span>
            </div>
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x border-b">
              <div className="p-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Net F&B Revenue</p>
                <p className="text-3xl font-extrabold text-slate-900 font-mono">{money(data.summary.netRevenue)}</p>
              </div>
              <div className="p-6 bg-slate-50/30">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actual COGS (Depleted)</p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-extrabold text-rose-600 font-mono">{money(data.profitability.actualCogs)}</p>
                  <p className="text-sm font-semibold text-rose-500">{pct(data.profitability.actualCostPct)}</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gross Profit</p>
                <p className="text-3xl font-extrabold text-emerald-600 font-mono">{money(data.profitability.grossProfit)}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-500 font-medium mr-2">Theoretical COGS (Recipe):</span>
                  <span className="font-mono font-bold text-slate-800">{money(data.profitability.theoreticalCogs)} ({pct(data.profitability.theoreticalCostPct)})</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium mr-2">Variance:</span>
                  <span className={`font-mono font-bold ${data.profitability.cogsVariance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {data.profitability.cogsVariance > 0 ? '+' : ''}{money(data.profitability.cogsVariance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section D: Inventory Control ── */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">D. Inventory Control Ledger</h2>
              {!selectedWarehouse && (
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                  Select a Warehouse to view Stock Reconciliation
                </span>
              )}
            </div>
            {selectedWarehouse ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-slate-600 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Stock Item</th>
                      <th className="px-4 py-3 text-right font-semibold">Opening</th>
                      <th className="px-4 py-3 text-right font-semibold text-emerald-600">Receipts</th>
                      <th className="px-4 py-3 text-right font-semibold text-indigo-600">Transfer In</th>
                      <th className="px-4 py-3 text-right font-semibold text-rose-600">Transfer Out</th>
                      <th className="px-4 py-3 text-right font-semibold text-amber-600">POS Sales</th>
                      <th className="px-4 py-3 text-right font-semibold text-rose-600">Waste</th>
                      <th className="px-4 py-3 text-right font-semibold">Adjust</th>
                      <th className="px-4 py-3 text-right font-semibold border-l bg-slate-50">Expected</th>
                      <th className="px-4 py-3 text-right font-semibold bg-slate-50">Actual Closing</th>
                      <th className="px-4 py-3 text-right font-semibold bg-slate-50">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.inventoryMovement.map((item: any) => (
                      <tr key={item.stockItemId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500">{item.sku} • {item.unitOfMeasure}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">{item.opening}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">{item.receipts || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-indigo-600">{item.transferIn || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-rose-600">{item.transferOut || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-amber-600">{item.sales || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-rose-600">{item.waste || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">{item.adjustments || '-'}</td>
                        
                        <td className="px-4 py-3 text-right font-mono font-semibold border-l bg-slate-50/50">{item.expectedClosing}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold bg-slate-50/50 text-indigo-900">{item.actualClosing}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold bg-slate-50/50 ${item.variance !== 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {item.variance !== 0 ? item.variance : '-'}
                        </td>
                      </tr>
                    ))}
                    {data.inventoryMovement.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-500">No stock movement recorded for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Box className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>Use the filters above to select a warehouse.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Package, RefreshCw, Search, Warehouse } from 'lucide-react';

type WarehouseRow = { id: string; name: string; parentWarehouseId: string | null; posOutlet?: { name: string } | null };
type StockRow = {
  stockItemId: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  bookQuantity: number;
  physicalQuantity: number | null;
  varianceQuantity: number | null;
  costPrice: number;
  mainStock: { purchaseUnit: string; unitsInBase: number; purchaseCost: number | null } | null;
};

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export default function FnbOutletStockPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [items, setItems] = useState<StockRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');

  const loadWarehouses = useCallback(async () => {
    const response = await fetch('/api/v1/inventory/warehouses?scope=outlet', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load outlet warehouses');
    const rows = (body.data || []) as WarehouseRow[];
    setWarehouses(rows);
    setWarehouseId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id || '');
  }, []);

  const loadStock = useCallback(async () => {
    if (!warehouseId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/inventory/reports/avt?warehouseId=${warehouseId}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load outlet stock');
      setItems(body.data?.items || []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load outlet stock');
    } finally { setLoading(false); }
  }, [warehouseId]);

  useEffect(() => { loadWarehouses().catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load warehouses')); }, [loadWarehouses]);
  useEffect(() => { loadStock(); }, [loadStock]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => !query || `${item.name} ${item.itemCode} ${item.category}`.toLowerCase().includes(query));
  }, [items, search]);
  const selectedWarehouse = warehouses.find((row) => row.id === warehouseId);
  const totalValue = items.reduce((sum, item) => sum + item.bookQuantity * item.costPrice, 0);
  const lowStock = items.filter((item) => item.bookQuantity <= 0).length;

  async function saveQuantity(item: StockRow) {
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0) return;
    setEditing(null);
    const response = await fetch(`/api/v1/inventory/stock-items/${item.stockItemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityOnHand: value, outletStockOnly: true }),
    });
    if (!response.ok) { const body = await response.json(); setError(body.error || 'Could not update outlet quantity'); return; }
    await loadStock();
  }

  return (
    <div className="min-h-full space-y-6">
      <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 text-[#24130d] shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-orange-700"><Package className="h-4 w-4" /> F&B outlet stock</div><h1 className="text-3xl font-bold">Outlet stock register</h1><p className="mt-2 text-sm text-[#927b70]">View and update stock held in your assigned outlet warehouse only.</p></div>
          <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><Warehouse className="h-4 w-4 text-orange-600" /><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="h-11 min-w-64 rounded-xl border border-orange-200 bg-white px-3 text-sm"><option value="">Select outlet warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.posOutlet?.name ? ` · ${warehouse.posOutlet.name}` : ''}</option>)}</select></label><button onClick={() => loadStock()} disabled={loading || !warehouseId} className="inline-flex h-11 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Outlet warehouse</p><p className="mt-2 text-lg font-bold text-slate-900">{selectedWarehouse?.name || '—'}</p><p className="mt-1 text-xs text-slate-500">{selectedWarehouse?.posOutlet?.name || 'Assigned outlet scope'}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock lines</p><p className="mt-2 text-3xl font-bold text-slate-900">{items.length}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">On-hand value</p><p className="mt-2 text-3xl font-bold text-amber-800">{money(totalValue)}</p><p className="mt-1 text-xs text-amber-700">{lowStock} lines at zero quantity</p></div></div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Stock in this outlet</h2><p className="mt-1 text-xs text-slate-500">Purchase setup and cost remain controlled by the main inventory team.</p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stock" className="h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400" /></label></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /></div> : !warehouseId ? <p className="p-12 text-center text-sm text-slate-500">No assigned outlet warehouse was found.</p> : visibleItems.length === 0 ? <p className="p-12 text-center text-sm text-slate-500">No stock lines found in this outlet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Stock item</th><th className="p-4">Category</th><th className="p-4 text-right">On hand</th><th className="p-4">Purchase setup</th><th className="p-4 text-right">Value</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleItems.map((item) => <tr key={item.stockItemId} className="hover:bg-orange-50/40"><td className="p-4"><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.itemCode} · {item.unit}</p></td><td className="p-4 text-slate-600">{item.category}</td><td className="p-4 text-right font-semibold text-slate-900">{item.bookQuantity.toLocaleString()} {item.unit}</td><td className="p-4 text-xs text-slate-600">{item.mainStock ? `${item.mainStock.purchaseUnit} · ${item.mainStock.unitsInBase} ${item.unit}/purchase unit` : 'Main setup unavailable'}</td><td className="p-4 text-right font-semibold text-slate-900">{money(item.bookQuantity * item.costPrice)}</td><td className="p-4 text-right">{editing === item.stockItemId ? <span className="inline-flex items-center gap-2"><input autoFocus type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-9 w-24 rounded border border-orange-300 px-2 text-right" /><button onClick={() => saveQuantity(item)} className="rounded bg-orange-600 px-3 py-2 text-xs font-semibold text-white">Save</button><button onClick={() => setEditing(null)} className="text-xs text-slate-500">Cancel</button></span> : <button onClick={() => { setEditing(item.stockItemId); setQuantity(String(item.bookQuantity)); }} className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50">Update quantity</button>}</td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}

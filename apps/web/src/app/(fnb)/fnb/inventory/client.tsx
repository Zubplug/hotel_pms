'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Edit2, Loader2, Package, RefreshCw, Search, Send, ShieldCheck, Trash2, Warehouse } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatUnit } from '@/lib/inventory/units';
import { OutletStockEditDialog } from './OutletStockEditDialog';

type WarehouseRecord = { id: string; name: string; parentWarehouseId?: string | null; posOutletId?: string | null };
type InventoryItem = {
  stockItemId: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  bookQuantity: number;
  costPrice: number;
  mainStock: { baseUnit: string; costPrice: number; purchaseCost: number | null; purchaseUnit: string; unitsInBase: number } | null;
};

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);
}

function buildHierarchy(warehouses: WarehouseRecord[]) {
  const byId = new Map<string, any>(warehouses.map((warehouse) => [warehouse.id, { ...warehouse, depth: 0, children: [] }]));
  const roots: any[] = [];
  byId.forEach((warehouse) => {
    const parent = warehouse.parentWarehouseId ? byId.get(warehouse.parentWarehouseId) : null;
    if (parent) parent.children = [...(parent.children || []), warehouse];
    else roots.push(warehouse);
  });
  const result: WarehouseRecord[] = [];
  const visit = (warehouse: any, depth: number) => {
    result.push({ ...warehouse, depth });
    (warehouse.children || []).forEach((child: any) => visit(child, depth + 1));
  };
  roots.forEach((warehouse: any) => visit(warehouse, 0));
  return result;
}

export function FnbInventoryClient() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouseName, setWarehouseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses?scope=outlet')
      .then((response) => response.json())
      .then((body) => {
        const hierarchy = buildHierarchy(body.data?.items || body.data || []);
        setWarehouses(hierarchy);
        if (hierarchy.length) setWarehouseId(hierarchy[0].id);
      })
      .catch(() => setError('Unable to load your inventory locations.'));
  }, []);

  async function loadInventory() {
    if (!warehouseId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/inventory/reports/avt?warehouseId=${warehouseId}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load inventory');
      setWarehouseName(body.data?.warehouse?.name || 'Selected location');
      setItems(body.data?.items || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadInventory(); }, [warehouseId]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.name} ${item.itemCode} ${item.category}`.toLowerCase().includes(query));
  }, [items, search]);

  const metrics = useMemo(() => {
    const quantity = items.reduce((sum, item) => sum + Number(item.bookQuantity || 0), 0);
    const value = items.reduce((sum, item) => sum + Number(item.bookQuantity || 0) * Number(item.costPrice || 0), 0);
    const low = items.filter((item) => Number(item.bookQuantity || 0) > 0 && Number(item.bookQuantity || 0) <= 5).length;
    const empty = items.filter((item) => Number(item.bookQuantity || 0) <= 0).length;
    return { quantity, value, low, empty };
  }, [items]);

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);
  const isOutlet = Boolean(selectedWarehouse?.posOutletId);

  return (
    <div className="min-h-screen bg-[#fbf8f6] p-4 font-sans text-[#24130d] sm:p-6 lg:p-8">
      <PageHeader
        title="F&B inventory"
        description="Monitor live stock availability and manage outlet stock flow. Balances update automatically from receipts, transfers, sales, and recipe consumption."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px]">
              <span className="mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Location</span>
              <Select value={warehouseId} onValueChange={(value) => setWarehouseId(value || '')}>
                <SelectTrigger className="h-11 rounded-xl border-[#eadfd8] bg-white text-[#24130d] shadow-sm"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent className="rounded-2xl border-[#eadfd8] bg-white p-2">
                  {warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id} className="rounded-xl py-3"><span className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-orange-600" />{warehouse.name}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => void loadInventory()} disabled={loading || !warehouseId} className="h-11 rounded-xl border-[#eadfd8] bg-white text-[#6f5d53] shadow-sm"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
            {isOutlet && <div className="flex gap-2"><Button onClick={() => { window.location.href = '/fnb/requisitions'; }} className="h-11 rounded-xl bg-orange-600 text-white shadow-sm hover:bg-orange-700"><Send className="mr-2 h-4 w-4" />Stock requisition</Button><Button variant="outline" onClick={() => { window.location.href = '/fnb/inventory/waste'; }} className="h-11 rounded-xl border-[#eadfd8] bg-white text-[#6f5d53] shadow-sm"><Trash2 className="mr-2 h-4 w-4 text-rose-600" />Waste log</Button></div>}
            {!isOutlet && <Button variant="outline" onClick={() => { window.location.href = '/inventory/approvals'; }} className="h-11 rounded-xl border-[#eadfd8] bg-white text-[#6f5d53] shadow-sm"><ShieldCheck className="mr-2 h-4 w-4 text-amber-600" />Approval Control Center</Button>}
          </div>
        }
      />

      {error && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-[#17243a] via-[#101b2d] to-[#0b1424] p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-300">Live F&amp;B stock control</p>
            <h2 className="mt-1 text-lg font-semibold">{warehouseName || 'Select an inventory location'}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Balances update automatically from approved receipts, stock transfers, POS sales, recipe consumption, and recorded waste. Use this workspace to monitor operational availability and value.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-300">{isOutlet ? 'Outlet operations' : 'Main warehouse view'}</div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Active items', value: items.length.toLocaleString(), note: 'Items available in this location', icon: Boxes, tone: 'orange' }, { label: 'Book quantity', value: metrics.quantity.toLocaleString(), note: 'Current system balance', icon: Package, tone: 'amber' }, { label: 'Stock value', value: money(metrics.value), note: 'Based on current unit cost', icon: Warehouse, tone: 'emerald' }, { label: 'Attention', value: `${metrics.low + metrics.empty}`, note: `${metrics.low} low · ${metrics.empty} empty`, icon: AlertTriangle, tone: metrics.low + metrics.empty ? 'red' : 'emerald' }].map(({ label, value, note, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">{label}</p><p className="mt-3 text-xl font-bold text-[#24130d]">{value}</p><p className="mt-1 text-xs text-[#927b70]">{note}</p></div><span className={`rounded-xl p-3 ${tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}><Icon className="h-5 w-5" /></span></div></div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-[0_8px_24px_rgba(65,32,19,0.05)]">
        <div className="flex flex-col gap-3 border-b border-[#f0e6e0] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold text-[#24130d]">Stock availability</h2><p className="mt-1 text-xs text-[#927b70]">Live balances in the selected location. Costs are controlled by stock management.</p></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a38e83]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or category…" className="h-10 rounded-xl border-[#eadfd8] pl-9" /></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#fffaf7] text-left text-[10px] uppercase tracking-[0.12em] text-[#927b70]"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3 text-right">Available</th><th className="px-5 py-3">Purchase setup</th><th className="px-5 py-3 text-right">Value</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#f3eae5]">{loading && <tr><td colSpan={5} className="py-14 text-center text-[#927b70]"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-orange-600" />Loading live stock…</td></tr>}{!loading && visibleItems.length === 0 && <tr><td colSpan={5} className="py-14 text-center text-[#927b70]">No stock items match this search.</td></tr>}{!loading && visibleItems.map((item) => { const purchase = item.mainStock; const quantity = Number(item.bookQuantity || 0); const purchaseQty = purchase && purchase.unitsInBase > 0 ? quantity / purchase.unitsInBase : null; return <tr key={item.stockItemId} className="hover:bg-[#fffaf7]"><td className="px-5 py-4"><p className="font-semibold text-[#24130d]">{item.name}</p><p className="mt-1 text-[11px] text-[#927b70]">{item.category} · {item.itemCode}</p></td><td className="px-5 py-4 text-right"><p className={`font-bold ${quantity <= 0 ? 'text-red-600' : quantity <= 5 ? 'text-amber-700' : 'text-[#24130d]'}`}>{quantity.toLocaleString()}</p><p className="mt-1 text-[11px] uppercase text-[#927b70]">{formatUnit(item.unit)}</p></td><td className="px-5 py-4 text-xs text-[#6f5d53]">{purchase ? <><p className="font-semibold text-[#24130d]">{purchaseQty?.toFixed(2)} {formatUnit(purchase.purchaseUnit)}</p><p className="mt-1">1 {formatUnit(purchase.purchaseUnit)} = {purchase.unitsInBase} {formatUnit(purchase.baseUnit)}</p></> : <span className="text-[#a38e83]">Stock setup unavailable</span>}</td><td className="px-5 py-4 text-right font-semibold text-[#24130d]">{money(quantity * Number(item.costPrice || 0))}</td><td className="px-5 py-4 text-right">{isOutlet && purchase ? <OutletStockEditDialog stockItemId={item.stockItemId} warehouseName={warehouseName || 'Selected outlet'} mainStock={purchase} onSaved={() => void loadInventory()} /> : <span className="inline-flex items-center gap-1 text-xs text-[#a38e83]"><Edit2 className="h-3.5 w-3.5" />Managed centrally</span>}</td></tr>; })}</tbody></table></div>
      </section>

      {isOutlet && <p className="mt-4 text-center text-xs text-[#927b70]">Temporary onboarding edit: use <strong>edit</strong> only to capture an opening/manual outlet balance when a hotel is first configured. Everyday stock is updated automatically through receiving, transfers, sales, and recipe usage.</p>}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Plus, Search, Send, X } from 'lucide-react';
import { formatUnit, purchaseSetup, toPurchaseQuantity } from '@/lib/inventory/units';

type Warehouse = { id: string; name: string; propertyId: string; posOutletId?: string | null };
type StockUnit = { unit: string; unitsInBase: number | string; isPurchaseUnit?: boolean };
type StockItem = { id: string; name: string; sku?: string | null; baseUnit: string; quantityOnHand: number | string; warehouseId: string; stockUnits?: StockUnit[] };
type Requisition = { id: string; transferRef: string; status: string; createdAt: string; fromWarehouse?: Warehouse; toWarehouse?: Warehouse; items?: { id: string }[]; requestedBy?: string };
type SelectedLine = { id: string; quantity: string; unit: string };

const statusStyle: Record<string, string> = {
  DRAFT: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  PENDING_APPROVAL: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  APPROVED: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200',
  ISSUED: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  COMPLETED: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  REJECTED: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
};

export default function RequisitionsClient({
  title = 'Stock requisitions',
  description = 'Request ingredients, beverages, and operating stock from the main warehouse for your outlet. Every request follows approval and dispatch control.',
}: { title?: string; description?: string }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [selected, setSelected] = useState<SelectedLine[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mainWarehouses = useMemo(() => warehouses.filter((item) => !item.posOutletId), [warehouses]);
  const outletWarehouses = useMemo(() => warehouses.filter((item) => item.posOutletId), [warehouses]);
  const source = mainWarehouses.find((item) => item.id === sourceId);
  const destination = outletWarehouses.find((item) => item.id === destinationId);
  const selectedIds = new Set(selected.map((item) => item.id));

  async function load() {
    setLoading(true);
    try {
      const [warehouseResponse, requisitionResponse] = await Promise.all([
        fetch('/api/v1/inventory/warehouses?scope=outlet'),
        fetch('/api/v1/fnb/inventory/requisitions'),
      ]);
      const warehouseBody = await warehouseResponse.json();
      const requisitionBody = await requisitionResponse.json();
      const loaded = warehouseBody.data?.items || warehouseBody.data || [];
      const mains = loaded.filter((item: Warehouse) => !item.posOutletId);
      setWarehouses(loaded);
      setRequisitions(requisitionBody.data?.requisitions || []);
      setSourceId((current) => current && mains.some((item: Warehouse) => item.id === current) ? current : mains.length === 1 ? mains[0].id : '');
      setDestinationId((current) => current || loaded.find((item: Warehouse) => item.posOutletId)?.id || '');
    } catch {
      setError('Unable to load requisition workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!sourceId) {
      setStockItems([]);
      return;
    }
    fetch(`/api/v1/inventory/stock-items?warehouseId=${encodeURIComponent(sourceId)}&limit=500`)
      .then((response) => response.json())
      .then((body) => setStockItems(body.data?.items || body.data || []))
      .catch(() => setStockItems([]));
  }, [sourceId]);

  const itemUnits = (item: StockItem) => {
    const purchase = purchaseSetup(item.baseUnit, item.stockUnits || []);
    return { purchaseUnit: purchase.unit, unitsInBase: Number(purchase.unitsInBase || 1) };
  };

  const availableItems = useMemo(() => stockItems
    .filter((item) => Number(item.quantityOnHand) > 0)
    .filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [stockItems, search]);
  const filtered = requisitions.filter((item) => filter === 'ALL' || item.status === filter);
  const pendingCount = requisitions.filter((item) => item.status === 'PENDING_APPROVAL').length;

  function addItem(id: string) {
    const item = stockItems.find((candidate) => candidate.id === id);
    if (!item || selectedIds.has(id)) return;
    setSelected((current) => [...current, { id, quantity: '1', unit: itemUnits(item).purchaseUnit }]);
  }

  function updateLine(id: string, patch: Partial<SelectedLine>) {
    setSelected((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  async function submit(action: 'DRAFT' | 'SUBMIT') {
    if (!source || !destination) return setError('Select the supplying mother warehouse and requesting outlet.');
    if (!selected.length) return setError('Select at least one stock item.');
    if (selected.some((item) => Number(item.quantity) <= 0)) return setError('Every requested quantity must be greater than zero.');
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/v1/fnb/inventory/requisitions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: source.propertyId,
          fromWarehouseId: source.id,
          toWarehouseId: destination.id,
          items: selected.map((item) => ({ itemId: item.id, quantity: Number(item.quantity), unitOfMeasure: item.unit })),
          action, requestId: crypto.randomUUID(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit requisition.');
      setOpen(false); setSelected([]); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit requisition.');
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#07101d] text-slate-100">
      <header className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_80%_-10%,rgba(249,115,22,.2),transparent_35%),linear-gradient(135deg,#101d30,#07101d)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl"><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">F&B operations / stock control</div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div><button onClick={() => { setOpen(true); setError(''); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-orange-400"><Plus className="h-4 w-4" />New requisition</button></div></div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-8">
        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200"><AlertCircle className="h-4 w-4" />{error}<button className="ml-auto" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
        <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total requests</p><p className="mt-3 text-2xl font-bold text-white">{requisitions.length}</p><p className="mt-1 text-xs text-slate-500">F&B requisitions in this workspace</p></div><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/70">Awaiting approval</p><p className="mt-3 text-2xl font-bold text-amber-200">{pendingCount}</p><p className="mt-1 text-xs text-slate-500">Requests pending stock control</p></div><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/70">Operating rule</p><p className="mt-3 text-sm font-bold text-emerald-200">Mother warehouse supply</p><p className="mt-1 text-xs text-slate-500">Outlet stock is not used as a requisition source</p></div></div>
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Request history</h2><p className="mt-1 text-xs text-slate-500">Track approval, dispatch, and completion.</p></div><div className="flex flex-wrap gap-2">{['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'COMPLETED'].map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${filter === value ? 'border-orange-300/30 bg-orange-300/15 text-orange-200' : 'border-white/[0.08] text-slate-500 hover:text-slate-300'}`}>{value === 'ALL' ? 'All' : value.replace('_', ' ')}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-white/[0.02] text-left text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Route</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={5} className="py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-orange-300" />Loading requisitions…</td></tr> : !filtered.length ? <tr><td colSpan={5} className="py-16 text-center text-slate-500">No requisitions in this view.</td></tr> : filtered.map((item) => <tr key={item.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4 font-mono text-xs font-bold text-orange-200">{item.transferRef}</td><td className="px-5 py-4 text-xs text-slate-300"><span>{item.fromWarehouse?.name}</span><ArrowRight className="mx-2 inline h-3 w-3 text-slate-600" /><span>{item.toWarehouse?.name}</span></td><td className="px-5 py-4 text-xs text-slate-400">{item.items?.length || 0} item lines</td><td className="px-5 py-4 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td><td className="px-5 py-4"><span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyle[item.status] || statusStyle.DRAFT}`}>{item.status.replace('_', ' ')}</span></td></tr>)}</tbody></table></div></section>
      </main>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101c2e] shadow-2xl"><div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-300">F&B stock request</p><h2 className="mt-1 text-xl font-semibold text-white">Create requisition</h2><p className="mt-1 text-xs text-slate-500">Stock is requested from the mother warehouse and delivered to your outlet.</p></div><button onClick={() => !saving && setOpen(false)} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div><div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/70">Supply from</p>{mainWarehouses.length > 1 ? <select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setSelected([]); }} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b1728] px-3 text-sm text-white"><option value="">Select mother warehouse</option>{mainWarehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <p className="mt-2 text-sm font-semibold text-white">{source?.name || 'Loading mother warehouse…'}<span className="mt-1 block text-[11px] font-normal text-cyan-200/60">Selected automatically</span></p>}</div><div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/70">Requesting outlet</p><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b1728] px-3 text-sm text-white"><option value="">Select outlet</option>{outletWarehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0b1728] p-4"><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-white">Select stock items</p><p className="mt-1 text-xs text-slate-500">Enter the request in purchase units or base units.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mother-warehouse stock…" className="h-9 w-full rounded-lg border border-white/10 bg-[#101c2e] pl-9 pr-3 text-sm text-white outline-none focus:border-orange-300/40" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-y border-white/[0.07] text-left text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="w-12 px-3 py-3">Add</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Available</th><th className="w-44 px-3 py-3">Request quantity</th><th className="w-36 px-3 py-3">Unit</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{!sourceId ? <tr><td colSpan={5} className="py-10 text-center text-slate-600">{mainWarehouses.length > 1 ? 'Select a mother warehouse to see stock.' : 'Loading mother warehouse stock…'}</td></tr> : !availableItems.length ? <tr><td colSpan={5} className="py-10 text-center text-slate-600">No active stock with a positive balance was found.</td></tr> : availableItems.slice(0, 100).map((item) => { const units = itemUnits(item); const line = selected.find((entry) => entry.id === item.id); const availablePurchase = toPurchaseQuantity(item.quantityOnHand, item.baseUnit, item.stockUnits || []); return <tr key={item.id} className={line ? 'bg-orange-300/[0.05]' : 'hover:bg-white/[0.025]'}><td className="px-3 py-3"><button type="button" onClick={() => line ? setSelected((current) => current.filter((entry) => entry.id !== item.id)) : addItem(item.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg border ${line ? 'border-orange-300/40 bg-orange-300/15 text-orange-200' : 'border-white/10 text-slate-600 hover:border-orange-300/30 hover:text-orange-200'}`}>{line ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button></td><td className="px-3 py-3"><p className="font-medium text-slate-200">{item.name}</p><p className="text-[11px] text-slate-600">{item.sku || 'No SKU'}</p></td><td className="px-3 py-3 text-xs text-slate-400">{availablePurchase.toLocaleString()} {formatUnit(units.purchaseUnit)}<span className="block text-[11px] text-slate-600">{Number(item.quantityOnHand).toLocaleString()} {formatUnit(item.baseUnit)} base</span></td><td className="px-3 py-3">{line ? <input type="number" min="0.01" step="any" value={line.quantity} onChange={(event) => updateLine(item.id, { quantity: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-[#101c2e] px-2 text-right text-sm text-white outline-none focus:border-orange-300/40" /> : <span className="text-xs text-slate-700">Select item</span>}</td><td className="px-3 py-3">{line ? <select value={line.unit} onChange={(event) => updateLine(item.id, { unit: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-[#101c2e] px-2 text-xs text-white"><option value={units.purchaseUnit}>{formatUnit(units.purchaseUnit)} (purchase)</option><option value={item.baseUnit}>{formatUnit(item.baseUnit)} (base)</option></select> : <span className="text-xs text-slate-600">—</span>}</td></tr>; })}</tbody></table></div><p className="mt-3 text-[11px] text-slate-600">{selected.length} item{selected.length === 1 ? '' : 's'} selected · Purchase quantities are converted to base units during approval processing.</p></div>
        <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4"><button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-400">Cancel</button><button onClick={() => void submit('SUBMIT')} disabled={saving || !selected.length} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit for approval</button></div>
      </div></div></div>}
    </div>
  );
}

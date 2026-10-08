'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2, Plus, Search, Send, X } from 'lucide-react';

type Warehouse = { id: string; name: string; propertyId: string; posOutletId?: string | null };
type StockItem = { id: string; name: string; sku?: string | null; baseUnit: string; quantityOnHand: number | string; warehouseId: string };
type Requisition = { id: string; transferRef: string; status: string; createdAt: string; fromWarehouse?: Warehouse; toWarehouse?: Warehouse; items?: { id: string }[]; requestedBy?: string };

const statusStyle: Record<string, string> = {
  DRAFT: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  PENDING_APPROVAL: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  APPROVED: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200',
  ISSUED: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  COMPLETED: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  REJECTED: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
};

export default function RequisitionsClient() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [selected, setSelected] = useState<{ id: string; quantity: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [warehouseResponse, stockResponse, requisitionResponse] = await Promise.all([
        fetch('/api/v1/inventory/warehouses?scope=outlet'),
        fetch('/api/v1/inventory/stock-items?limit=500'),
        fetch('/api/v1/fnb/inventory/requisitions'),
      ]);
      const warehouseBody = await warehouseResponse.json();
      const stockBody = await stockResponse.json();
      const requisitionBody = await requisitionResponse.json();
      const loadedWarehouses = warehouseBody.data?.items || warehouseBody.data || [];
      setWarehouses(loadedWarehouses);
      setStockItems(stockBody.data?.items || stockBody.data || []);
      setRequisitions(requisitionBody.data?.requisitions || []);
      setSourceId((current) => current || loadedWarehouses.find((item: Warehouse) => !item.posOutletId)?.id || '');
      setDestinationId((current) => current || loadedWarehouses.find((item: Warehouse) => item.posOutletId)?.id || '');
    } catch {
      setError('Unable to load requisition workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const sourceItems = useMemo(() => stockItems.filter((item) => item.warehouseId === sourceId && Number(item.quantityOnHand) > 0 && item.name.toLowerCase().includes(search.toLowerCase())), [stockItems, sourceId, search]);
  const filtered = requisitions.filter((item) => filter === 'ALL' || item.status === filter);
  const pendingCount = requisitions.filter((item) => item.status === 'PENDING_APPROVAL').length;
  const selectedIds = new Set(selected.map((item) => item.id));

  function addItem(id: string) {
    if (!selectedIds.has(id)) setSelected((current) => [...current, { id, quantity: '1' }]);
  }

  async function submit(action: 'DRAFT' | 'SUBMIT') {
    const source = warehouses.find((item) => item.id === sourceId);
    const destination = warehouses.find((item) => item.id === destinationId);
    if (!sourceId || !destinationId || !source || source.posOutletId || !destination?.posOutletId) return setError('Choose a main warehouse and your outlet.');
    if (!selected.length) return setError('Add at least one stock item.');
    if (selected.some((item) => Number(item.quantity) <= 0)) return setError('Every requested quantity must be greater than zero.');
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/v1/fnb/inventory/requisitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: source.propertyId, fromWarehouseId: sourceId, toWarehouseId: destinationId, items: selected.map((item) => ({ itemId: item.id, quantity: Number(item.quantity) })), action, requestId: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit requisition.');
      setOpen(false); setSelected([]); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit requisition.'); } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#07101d] text-slate-100">
      <header className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_80%_-10%,rgba(249,115,22,.2),transparent_35%),linear-gradient(135deg,#101d30,#07101d)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl"><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">F&B operations / stock control</div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Stock requisitions</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Request ingredients, beverages, and operating stock from the main warehouse for your outlet. Every request follows approval and dispatch control.</p></div><button onClick={() => { setOpen(true); setError(''); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-orange-400"><Plus className="h-4 w-4" />New requisition</button></div></div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-8">
        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200"><AlertCircle className="h-4 w-4" />{error}<button className="ml-auto" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
        <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total requests</p><p className="mt-3 text-2xl font-bold text-white">{requisitions.length}</p><p className="mt-1 text-xs text-slate-500">F&B requisitions in this workspace</p></div><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/70">Awaiting approval</p><p className="mt-3 text-2xl font-bold text-amber-200">{pendingCount}</p><p className="mt-1 text-xs text-slate-500">Requests pending stock control</p></div><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/70">Operating rule</p><p className="mt-3 text-sm font-bold text-emerald-200">Main warehouse supply</p><p className="mt-1 text-xs text-slate-500">Outlet stock is not used as a requisition source</p></div></div>
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Request history</h2><p className="mt-1 text-xs text-slate-500">Track approval, dispatch, and completion.</p></div><div className="flex flex-wrap gap-2">{['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'COMPLETED'].map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${filter === value ? 'border-orange-300/30 bg-orange-300/15 text-orange-200' : 'border-white/[0.08] text-slate-500 hover:text-slate-300'}`}>{value === 'ALL' ? 'All' : value.replace('_', ' ')}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-white/[0.02] text-left text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Route</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={5} className="py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-orange-300" />Loading requisitions…</td></tr> : !filtered.length ? <tr><td colSpan={5} className="py-16 text-center text-slate-500">No requisitions in this view.</td></tr> : filtered.map((item) => <tr key={item.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4 font-mono text-xs font-bold text-orange-200">{item.transferRef}</td><td className="px-5 py-4 text-xs text-slate-300"><span>{item.fromWarehouse?.name}</span><ArrowRight className="mx-2 inline h-3 w-3 text-slate-600" /><span>{item.toWarehouse?.name}</span></td><td className="px-5 py-4 text-xs text-slate-400">{item.items?.length || 0} item lines</td><td className="px-5 py-4 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td><td className="px-5 py-4"><span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyle[item.status] || statusStyle.DRAFT}`}>{item.status.replace('_', ' ')}</span></td></tr>)}</tbody></table></div></section>
      </main>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"><div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101c2e] shadow-2xl"><div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-300">F&B stock request</p><h2 className="mt-1 text-xl font-semibold text-white">Create requisition</h2><p className="mt-1 text-xs text-slate-500">Choose the supplying main warehouse, your outlet, and required items.</p></div><button onClick={() => !saving && setOpen(false)} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div><div className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-400">Supply from<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setSelected([]); }} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-slate-200"><option value="">Select main warehouse</option>{warehouses.filter((item) => !item.posOutletId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-400">Requesting outlet<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-slate-200"><option value="">Select outlet</option>{warehouses.filter((item) => item.posOutletId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-400">Add stock items</p><span className="text-[11px] text-slate-600">{selected.length} selected</span></div><div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search available main-warehouse stock…" className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1728] pl-9 pr-3 text-sm text-white outline-none focus:border-orange-300/40" /></div><div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0b1728] p-2">{sourceItems.slice(0, 50).map((item) => <button key={item.id} disabled={selectedIds.has(item.id)} onClick={() => addItem(item.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.05] disabled:opacity-40"><span><span className="block text-sm text-slate-200">{item.name}</span><span className="text-[11px] text-slate-500">{item.quantityOnHand} {item.baseUnit} available</span></span><Plus className="h-4 w-4 text-orange-300" /></button>)}{!sourceItems.length && <p className="p-4 text-center text-xs text-slate-600">Select a main warehouse to see available stock.</p>}</div></div>{selected.length > 0 && <div className="space-y-2">{selected.map((line) => { const item = stockItems.find((candidate) => candidate.id === line.id); return <div key={line.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item?.name}</span><input type="number" min="0.01" step="any" value={line.quantity} onChange={(event) => setSelected((current) => current.map((entry) => entry.id === line.id ? { ...entry, quantity: event.target.value } : entry))} className="h-9 w-28 rounded-lg border border-white/10 bg-[#0b1728] px-2 text-right text-sm text-white" /><span className="w-16 text-xs text-slate-500">{item?.baseUnit}</span><button onClick={() => setSelected((current) => current.filter((entry) => entry.id !== line.id))} className="text-slate-600 hover:text-rose-300"><X className="h-4 w-4" /></button></div>; })}</div>}<div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4"><button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-400">Cancel</button><button onClick={() => void submit('SUBMIT')} disabled={saving || !selected.length} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit for approval</button></div></div></div></div>}
    </div>
  );
}

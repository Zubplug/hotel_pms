'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type StockItem = { id: string; name: string; baseUnit: string; stockUnits?: { unit: string }[] };
type Waste = { id: string; quantity: string | number; unitOfMeasure: string; reason: string; status: string; totalValue: string | number; stockItem: { name: string; baseUnit: string } };

export default function KitchenWastePage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [entries, setEntries] = useState<Waste[]>([]);
  const [form, setForm] = useState({ stockItemId: '', quantity: '', unitOfMeasure: '', reason: 'SPOILAGE', notes: '' });
  const [message, setMessage] = useState('');

  async function load() {
    const [stockResponse, wasteResponse] = await Promise.all([
      fetch('/api/v1/inventory/stock-items?limit=500'),
      fetch('/api/v1/pos/kitchen/waste'),
    ]);
    const stockJson = await stockResponse.json();
    const wasteJson = await wasteResponse.json();
    setItems(stockJson.data?.items || stockJson.data || []);
    setEntries(wasteJson.data || []);
  }

  useEffect(() => { load().catch(() => setMessage('Unable to load kitchen waste data')); }, []);

  const selected = items.find((item) => item.id === form.stockItemId);
  const units = selected ? [selected.baseUnit, ...(selected.stockUnits || []).map((unit) => unit.unit)] : [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/v1/pos/kitchen/waste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const json = await response.json();
    setMessage(json.error || 'Waste submitted for approval');
    if (response.ok) { setForm({ stockItemId: '', quantity: '', unitOfMeasure: '', reason: 'SPOILAGE', notes: '' }); await load(); }
  }

  async function action(id: string, actionName: string) {
    const response = await fetch(`/api/v1/pos/kitchen/waste/${id}/action`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName }) });
    const json = await response.json();
    setMessage(json.error || `Waste ${actionName}d`);
    if (response.ok) await load();
  }

  return <main className="max-w-6xl mx-auto p-6 space-y-6">
    <div><Link href="/inventory/cost-control" className="text-sm text-slate-500">← Cost control</Link><h1 className="text-2xl font-bold mt-2">Kitchen waste & spoilage</h1><p className="text-sm text-slate-500">Record waste in its issue unit, approve it, then post the base-unit stock deduction.</p></div>
    {message && <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm">{message}</div>}
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-5">
      <select required value={form.stockItemId} onChange={(e) => setForm({ ...form, stockItemId: e.target.value, unitOfMeasure: '' })} className="rounded border p-2"><option value="">Stock item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.baseUnit})</option>)}</select>
      <input required type="number" min="0.0001" step="0.0001" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded border p-2" />
      <select required value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} className="rounded border p-2"><option value="">Unit</option>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
      <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="rounded border p-2">{['SPOILAGE', 'OVER_PRODUCTION', 'BURNED', 'DAMAGED', 'RETURNED', 'WRONG_ORDER', 'OTHER'].map((reason) => <option key={reason}>{reason}</option>)}</select>
      <button className="rounded bg-slate-900 px-4 py-2 font-semibold text-white">Submit waste</button>
      <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded border p-2 md:col-span-5" />
    </form>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr><th className="p-3">Item</th><th className="p-3">Quantity</th><th className="p-3">Reason</th><th className="p-3">Value</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-b"><td className="p-3">{entry.stockItem.name}</td><td className="p-3">{entry.quantity} {entry.unitOfMeasure}</td><td className="p-3">{entry.reason}</td><td className="p-3">{Number(entry.totalValue).toLocaleString()}</td><td className="p-3">{entry.status}</td><td className="space-x-2 p-3">{entry.status === 'SUBMITTED' && <><button onClick={() => action(entry.id, 'approve')} className="text-emerald-700">Approve</button><button onClick={() => action(entry.id, 'reject')} className="text-red-700">Reject</button></>}{entry.status === 'APPROVED' && <button onClick={() => action(entry.id, 'post')} className="font-semibold text-blue-700">Post</button>}</td></tr>)}</tbody></table></div>
  </main>;
}

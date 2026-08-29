'use client';

import { useState } from 'react';
import { Trash2, Save, X } from 'lucide-react';

type Item = {
  id: string;
  description: string;
  quantity: number | string;
  unitOfMeasure: string;
  unitPrice: number | string;
  totalPrice: number | string;
  receivedQty: number | string;
  stockItemName: string;
  stockType: string;
};

export function POItemsEditor({ poId, items, editable, currency }: { poId: string; items: Item[]; editable: boolean; currency: string }) {
  const [rows, setRows] = useState(items.map(item => ({ ...item })));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const units = ['KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'BOX', 'BOTTLE', 'PACK'];
  const total = rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

  const update = (id: string, field: keyof Item, value: string) => setRows(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  const remove = (id: string) => setRows(current => current.filter(item => item.id !== id));
  const cancel = () => { setRows(items.map(item => ({ ...item }))); setError(''); setEditing(false); };

  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${poId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows.map(item => ({ id: item.id, description: item.description, quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure, unitPrice: Number(item.unitPrice) })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to save PO adjustments');
      setEditing(false); window.location.reload();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  return <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
      {editable && !editing && <button onClick={() => setEditing(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Adjust Items</button>}
      {editing && <div className="flex gap-2"><button onClick={cancel} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 border rounded-lg"><X className="w-3 h-3" />Cancel</button><button onClick={save} disabled={saving || rows.length === 0} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg disabled:opacity-50"><Save className="w-3 h-3" />{saving ? 'Saving...' : 'Save Changes'}</button></div>}
    </div>
    {error && <p className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="px-6 py-4 font-medium">Item</th><th className="px-6 py-4 font-medium text-right">Qty</th><th className="px-6 py-4 font-medium">UOM</th><th className="px-6 py-4 font-medium text-right">Unit Price</th><th className="px-6 py-4 font-medium text-right">Total</th><th className="px-6 py-4" /></tr></thead><tbody className="divide-y divide-slate-200">
      {rows.map(item => <tr key={item.id}><td className="px-6 py-4">{editing ? <input value={item.description} onChange={e => update(item.id, 'description', e.target.value)} className="w-full min-w-48 px-2 py-1 border rounded text-slate-900" /> : <><span className="font-medium text-slate-900">{item.stockItemName}</span><span className="block text-xs text-slate-500 capitalize">{item.stockType.replace('_', ' ').toLowerCase()}{item.description ? ` · ${item.description}` : ''}</span></>}</td><td className="px-6 py-4 text-right">{editing ? <input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={e => update(item.id, 'quantity', e.target.value)} className="w-24 px-2 py-1 border rounded text-right text-slate-900" /> : Number(item.quantity).toFixed(2)}</td><td className="px-6 py-4">{editing ? <select value={item.unitOfMeasure} onChange={e => update(item.id, 'unitOfMeasure', e.target.value)} className="px-2 py-1 border rounded text-slate-900">{units.map(unit => <option key={unit}>{unit}</option>)}</select> : item.unitOfMeasure}</td><td className="px-6 py-4 text-right">{editing ? <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => update(item.id, 'unitPrice', e.target.value)} className="w-28 px-2 py-1 border rounded text-right text-slate-900" /> : Number(item.unitPrice).toFixed(2)}</td><td className="px-6 py-4 text-right font-semibold">{currency} {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="px-6 py-4 text-right">{editing && <button onClick={() => remove(item.id)} title="Remove item" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}</td></tr>)}
    </tbody><tfoot className="bg-slate-50 border-t"><tr><td colSpan={4} className="px-6 py-4 text-right font-semibold text-slate-500">Total</td><td className="px-6 py-4 text-right font-bold text-slate-900">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td /></tr></tfoot></table></div>
  </div>;
}

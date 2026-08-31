'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function CashierModifiersPage() {
  const { data: session } = useSession();
  const propertyId = String((session?.user as any)?.propertyId || '');
  const [products, setProducts] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [form, setForm] = useState({ productId: '', name: '', price: '', stockItemId: '', quantity: '1', unitOfMeasure: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    void Promise.all([fetch(`/api/v1/pos/products?propertyId=${propertyId}`).then((response) => response.json()), fetch('/api/v1/pos/modifier-requests').then((response) => response.json())]).then(([productBody, stockBody]) => { setProducts(productBody.data || []); setStockItems(stockBody.data || []); });
  }, [propertyId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/v1/pos/modifier-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price) }) });
    const body = await response.json();
    setMessage(body.error || (response.ok ? 'Modifier request submitted for Accountant review.' : 'Unable to submit modifier request'));
    if (response.ok) setForm({ productId: '', name: '', price: '', stockItemId: '', quantity: '1', unitOfMeasure: '' });
    setSaving(false);
  };

  const selectedStock = stockItems.find((item) => item.id === form.stockItemId);
  const units = selectedStock ? [selectedStock.baseUnit, ...(selectedStock.stockUnits || []).map((unit: any) => unit.unit)] : [];
  return <main className="max-w-4xl space-y-6 p-6"><div><h1 className="text-2xl font-bold text-slate-900">Modifier Requests</h1><p className="text-sm text-slate-500">Request add-ons such as extra cheese or a larger portion. Link stock optionally for automatic deduction when the modifier is sold.</p></div>{message && <div className="rounded-lg border bg-slate-50 p-3 text-sm">{message}</div>}<form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border bg-white p-5"><label className="block text-sm font-medium">Menu item<select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Select menu item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="block text-sm font-medium">Modifier name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Extra cheese" className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm font-medium">Additional price<input required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label><div className="border-t pt-4"><p className="mb-2 text-xs text-slate-500">Optional stock deduction</p><div className="grid grid-cols-2 gap-3"><select value={form.stockItemId} onChange={(event) => setForm({ ...form, stockItemId: event.target.value, unitOfMeasure: '' })} className="rounded-lg border p-2.5 text-sm"><option value="">No stock link</option>{stockItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input min="0.0001" step="0.0001" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="rounded-lg border p-2.5 text-sm" placeholder="Qty per modifier" /></div>{selectedStock && <select required value={form.unitOfMeasure} onChange={(event) => setForm({ ...form, unitOfMeasure: event.target.value })} className="mt-3 w-full rounded-lg border p-2.5 text-sm"><option value="">Select deduction unit</option>{units.map((unit: string) => <option key={unit} value={unit}>{unit}</option>)}</select>}<p className="mt-2 text-xs text-slate-400">Example: 1 EXTRA CHEESE uses 0.05 KG of cheese. Leave unlinked for non-stock add-ons.</p></div><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit modifier request'}</button></form></main>;
}

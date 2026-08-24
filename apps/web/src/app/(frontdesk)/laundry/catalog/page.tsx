'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Shirt, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

export default function LaundryCatalogPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const fetchItems = async () => {
    if (!propertyId) return;
    const res = await fetch(`/api/v1/laundry/items?propertyId=${propertyId}`);
    const data = await res.json();
    setItems(data.data || []);
  };

  useEffect(() => {
    fetchItems();
  }, [propertyId]);

  const handleAddItem = async (e: any) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;

    await fetch('/api/v1/laundry/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        name: newItemName,
        basePrice: parseFloat(newItemPrice)
      })
    });
    setNewItemName('');
    setNewItemPrice('');
    fetchItems();
  };

  if (!propertyId) return <div className="p-8 text-center text-slate-500">Select property</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> Laundry Catalog
            </h1>
          </div>
        </div>

        <form onSubmit={handleAddItem} className="flex gap-4 items-end bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-bold text-slate-700">Item Name</label>
            <Input required value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. Silk Shirt" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
          </div>
          <div className="w-32 space-y-2">
            <label className="block text-sm font-bold text-slate-700">Base Price</label>
            <Input required type="number" min="0" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} placeholder="0.00" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
          </div>
          <Button type="submit" className="h-12 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md">
            <Plus className="w-5 h-5 mr-2" /> Add
          </Button>
        </form>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs font-bold">
              <tr>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Base Price</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr><td colSpan={3} className="text-center p-12 text-slate-400">No items in catalog.</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 font-bold text-slate-900 text-base">{item.name}</td>
                  <td className="px-6 py-5 font-semibold text-slate-600">{formatCurrency(Number(item.basePrice), item.currency)}</td>
                  <td className="px-6 py-5">
                    {item.isActive ? (
                      <span className="text-emerald-600 font-medium text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full w-fit"><CheckCircle2 className="w-3 h-3"/> Active</span>
                    ) : (
                      <span className="text-red-600 font-medium text-xs flex items-center gap-1 bg-red-50 px-2 py-1 rounded-full w-fit"><XCircle className="w-3 h-3"/> Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

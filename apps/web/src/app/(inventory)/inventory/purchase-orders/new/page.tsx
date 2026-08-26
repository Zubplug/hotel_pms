'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);

  const [poData, setPoData] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
  });

  const [items, setItems] = useState([{ stockItemId: '', description: '', quantity: 1, uom: '', unitPrice: 0 }]);

  useEffect(() => {
    fetch('/api/v1/inventory/suppliers').then(r => r.json()).then(setSuppliers);
    fetch('/api/v1/inventory/stock-items').then(r => r.json()).then(setStockItems);
  }, []);

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...poData, items })
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/inventory/purchase-orders/${id}`);
      } else {
        alert('Failed to create PO');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Purchase Order</h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          <span className={step === 1 ? 'text-blue-600' : 'text-slate-500'}>1. Details</span>
          <ArrowRight className="w-4 h-4 text-slate-600" />
          <span className={step === 2 ? 'text-blue-600' : 'text-slate-500'}>2. Line Items</span>
        </div>
      </div>

      <div className="bg-white border border-slate-800 rounded-xl p-6">
        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
              <select
                required
                value={poData.supplierId}
                onChange={e => setPoData({ ...poData, supplierId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={poData.expectedDate}
                onChange={e => setPoData({ ...poData, expectedDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={poData.notes}
                onChange={e => setPoData({ ...poData, notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                disabled={!poData.supplierId}
                onClick={() => setStep(2)}
                className="bg-blue-600 hover:bg-blue-700 text-slate-900 px-6 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
              >
                Next Step
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Stock Item</label>
                        <select
                          value={item.stockItemId}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[idx].stockItemId = e.target.value;
                            setItems(newItems);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 text-sm"
                        >
                          <option value="">Select item...</option>
                          {stockItems.map(si => <option key={si.id} value={si.id}>{si.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Description (Optional)</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[idx].description = e.target.value;
                            setItems(newItems);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[idx].quantity = Number(e.target.value);
                            setItems(newItems);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">UOM</label>
                        <input
                          type="text"
                          placeholder="e.g. Box, Kg"
                          value={item.uom}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[idx].uom = e.target.value;
                            setItems(newItems);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[idx].unitPrice = Number(e.target.value);
                            setItems(newItems);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors mt-6"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setItems([...items, { stockItemId: '', description: '', quantity: 1, uom: '', unitPrice: 0 }])}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-300 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Line Item
            </button>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <div className="text-xl font-bold text-slate-900">
                Total: <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  disabled={loading || items.length === 0 || !items.every(i => i.stockItemId)}
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-slate-900 px-6 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit PO'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

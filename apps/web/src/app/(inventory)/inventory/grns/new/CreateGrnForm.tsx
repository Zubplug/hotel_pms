'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle } from 'lucide-react';

type Item = {
  id: string;
  stockItemId: string;
  description: string;
  quantity: number;
  receivedQty: number;
  remainingQty: number;
  unitCost: number;
  uom: string;
};

export function CreateGrnForm({ poId, items }: { poId: string, items: Item[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  
  // State for quantities to receive
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>(
    items.reduce((acc, item) => ({ ...acc, [item.id]: item.remainingQty > 0 ? item.remainingQty : 0 }), {})
  );

  const handleQtyChange = (itemId: string, value: string) => {
    const num = parseFloat(value);
    setReceiveQtys(prev => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : num
    }));
  };

  const handleCreate = async () => {
    setError(null);
    const payloadItems = items.map(item => ({
      poItemId: item.id,
      receivedQty: receiveQtys[item.id] || 0,
      unitCost: item.unitCost
    })).filter(i => i.receivedQty > 0);

    if (payloadItems.length === 0) {
      setError('You must receive at least one item with a quantity greater than 0.');
      return;
    }

    // Validate over-receiving
    for (const item of payloadItems) {
      const originalItem = items.find(i => i.id === item.poItemId);
      if (originalItem && item.receivedQty > originalItem.remainingQty) {
        setError(`Cannot receive more than the remaining quantity for ${originalItem.description}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${poId}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, deliveryNoteRef })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create GRN');
      }

      router.push(`/inventory/grns/${data.data.grn.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Receipt Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-4 font-medium">Item</th>
                <th className="px-6 py-4 font-medium text-right">Ordered</th>
                <th className="px-6 py-4 font-medium text-right">Previously Received</th>
                <th className="px-6 py-4 font-medium text-right text-amber-600">Remaining</th>
                <th className="px-6 py-4 font-medium text-right">Receive Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="text-xs text-slate-500">{item.uom}</p>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-6 py-4 text-right text-slate-700">{item.receivedQty}</td>
                  <td className="px-6 py-4 text-right font-medium text-amber-600">{item.remainingQty}</td>
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      min="0"
                      max={item.remainingQty}
                      step="0.01"
                      value={receiveQtys[item.id] === 0 ? '' : receiveQtys[item.id]}
                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                      className="w-24 px-3 py-1.5 text-right border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900"
                      disabled={item.remainingQty <= 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex-1 max-w-sm">
          <label htmlFor="deliveryNoteRef" className="block text-sm font-medium text-slate-700 mb-1">
            Delivery Note Reference (Optional)
          </label>
          <input
            type="text"
            id="deliveryNoteRef"
            value={deliveryNoteRef}
            onChange={(e) => setDeliveryNoteRef(e.target.value)}
            className="block w-full px-4 py-2 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900"
            placeholder="e.g. DN-100293"
          />
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Creating GRN...' : 'Save Draft GRN'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

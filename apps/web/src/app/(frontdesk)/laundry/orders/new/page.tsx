'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Shirt, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function NewLaundryOrderPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reservationId, setReservationId] = useState('');
  const [serviceType, setServiceType] = useState('STANDARD');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/v1/laundry/items?propertyId=${propertyId}`)
      .then(res => res.json())
      .then(data => setItems(data.data || []));
  }, [propertyId]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const orderItems = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    if (orderItems.length === 0) return alert('Select at least one item');
    setLoading(true);

    const res = await fetch('/api/v1/laundry/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        reservationId,
        serviceType,
        items: orderItems
      })
    });

    if (res.ok) {
      router.push('/laundry');
    } else {
      const error = await res.json();
      alert(error.message);
      setLoading(false);
    }
  };

  const currentTotal = items.reduce((acc, item) => {
    return acc + (selectedItems[item.id] || 0) * Number(item.basePrice);
  }, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> New Laundry Order
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Reservation ID</label>
              <Input 
                required 
                value={reservationId} 
                onChange={e => setReservationId(e.target.value)} 
                placeholder="UUID of active reservation" 
                className="h-12 rounded-xl bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Service Type</label>
              <select 
                className="w-full h-12 border border-slate-200 rounded-xl bg-slate-50 px-3 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-cyan-500" 
                value={serviceType} 
                onChange={e => setServiceType(e.target.value)}
              >
                <option value="STANDARD">Standard (Regular Price)</option>
                <option value="EXPRESS">Express (50% Surcharge)</option>
                <option value="DRY_CLEAN">Dry Clean Only</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <label className="block text-lg font-bold text-slate-900">Laundry Items</label>
              <span className="font-bold text-slate-500">Total: <span className="text-cyan-700">{formatCurrency(currentTotal, 'NGN')}</span></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => {
                const qty = selectedItems[item.id] || 0;
                const isSelected = qty > 0;
                
                return (
                  <div key={item.id} className={`border p-4 rounded-2xl flex justify-between items-center transition-colors ${isSelected ? 'border-cyan-300 bg-cyan-50/30 shadow-sm' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div>
                      <p className={`font-bold ${isSelected ? 'text-cyan-900' : 'text-slate-700'}`}>{item.name}</p>
                      <p className="text-sm font-medium text-slate-500">{formatCurrency(Number(item.basePrice), item.currency)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: Math.max(0, qty - 1) })}>-</Button>
                      <span className="font-bold w-6 text-center">{qty}</span>
                      <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full border-cyan-200 text-cyan-700 hover:bg-cyan-100" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: qty + 1 })}>+</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="h-14 px-8 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-lg shadow-cyan-600/20 text-lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              Place Order ({formatCurrency(currentTotal, 'NGN')})
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

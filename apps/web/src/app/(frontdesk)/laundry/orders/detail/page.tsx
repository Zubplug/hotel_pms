'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Shirt, CheckCircle2, Clock, Truck, CreditCard, Banknote, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function ManageLaundryOrderPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchOrder = async () => {
    if (!propertyId) return;
    setLoading(true);
    // Fetch all and filter, since we don't have a single-order endpoint in the provider interface yet
    const res = await provider.laundry.getOrders(propertyId);
    if (res.data) {
      const found = res.data.find((o: any) => o.id === orderId);
      setOrder(found || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, [propertyId, orderId]);

  const handleUpdateStatus = async (status: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await provider.laundry.updateOrderStatus(order.id, status);
      if (!res.error) {
        await fetchOrder();
      } else {
        alert(res.error || 'Failed to update status');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!order) return;
    if (!confirm('Deliver this order? This will create a Folio charge for the guest.')) return;
    setUpdating(true);
    try {
      const res = await provider.laundry.deliverOrder(order.id);
      if (!res.error) {
        await fetchOrder();
      } else {
        alert(res.error || 'Failed to deliver order');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSettlePayment = async () => {
    if (!order?.folioItem?.folio) return;
    const folio = order.folioItem.folio;
    
    if (folio.balance <= 0) return alert('Folio is already fully paid.');
    
    setProcessingPayment(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: folio.id,
          amount: Number(folio.balance),
          currency: folio.currency,
          method: paymentMethod,
          idempotencyKey: `laundry_pay_${order.id}_${Date.now()}`,
          notes: 'Walk-in laundry payment settled via frontdesk'
        })
      });
      
      const data = await res.json();
      if (res.ok || res.status === 201 || res.status === 200) {
        alert('Payment recorded successfully!');
        await fetchOrder();
      } else {
        alert(data.error || 'Failed to process payment');
      }
    } catch (e: any) {
      alert('Network error while processing payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (!propertyId) return <div className="p-8 text-center text-slate-500">Select property</div>;
  
  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>;
  if (!order) return <div className="p-20 text-center text-slate-500">Order not found</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> Manage Order
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-500">Total</p>
            <p className="text-2xl font-black text-cyan-700">{formatCurrency(Number(order.totalAmount), order.currency)}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 space-y-8">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100">
             <div>
               <p className="text-sm font-bold text-slate-500">Status</p>
               <p className="text-2xl font-black text-slate-800">{order.status}</p>
             </div>
             <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <Button onClick={() => handleUpdateStatus('COLLECTED')} disabled={updating} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Clock className="w-4 h-4 mr-2"/>} Collect
                  </Button>
                )}
                {order.status === 'COLLECTED' && (
                  <Button onClick={() => handleUpdateStatus('WASHING')} disabled={updating} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Shirt className="w-4 h-4 mr-2"/>} Start Washing
                  </Button>
                )}
                {order.status === 'WASHING' && (
                  <Button onClick={() => handleUpdateStatus('READY')} disabled={updating} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>} Mark Ready
                  </Button>
                )}
                {order.status === 'READY' && (
                  <Button onClick={handleDeliver} disabled={updating} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-8 h-12 text-lg font-bold shadow-lg shadow-cyan-600/20">
                     {updating ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <Truck className="w-5 h-5 mr-2"/>} Deliver & Charge
                  </Button>
                )}
             </div>
          </div>

           <div>
             <h2 className="text-lg font-bold mb-4">Items</h2>
             <div className="space-y-3">
               {order.items?.map((item: any) => (
                 <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-800">{item.quantity}x {item.item?.name || 'Item'}</span>
                    <span className="font-semibold text-slate-600">{formatCurrency(Number(item.priceAtTime), order.currency)}</span>
                 </div>
               ))}
             </div>
          </div>

          {order.customerType === 'WALK_IN' && order.status === 'DELIVERED' && order.folioItem?.folio && (
            <div className="mt-8 p-6 bg-cyan-50/50 rounded-2xl border border-cyan-100">
              <h2 className="text-lg font-bold text-cyan-900 mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5" /> Walk-In Folio Settlement
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Charges</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(Number(order.folioItem.folio.totalCharges), order.folioItem.folio.currency)}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</p>
                  <p className="text-xl font-black text-emerald-600">{formatCurrency(Number(order.folioItem.folio.totalPayments), order.folioItem.folio.currency)}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-cyan-200 ring-2 ring-cyan-100 col-span-2">
                  <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Balance Due</p>
                  <p className="text-2xl font-black text-cyan-700">{formatCurrency(Number(order.folioItem.folio.balance), order.folioItem.folio.currency)}</p>
                </div>
              </div>

              {Number(order.folioItem.folio.balance) > 0 ? (
                <div className="flex items-end gap-4 p-4 bg-white rounded-xl border border-slate-200">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-bold text-slate-700">Payment Method</label>
                    <select 
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg px-3 font-medium outline-none focus:ring-2 focus:ring-cyan-500"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="POS">POS / Card Terminal</option>
                      <option value="CARD">Online Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <Button 
                    onClick={handleSettlePayment} 
                    disabled={processingPayment} 
                    className="h-12 px-8 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow-md"
                  >
                    {processingPayment ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Banknote className="w-5 h-5 mr-2" />}
                    Record Payment
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center font-bold">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> Folio Fully Settled
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

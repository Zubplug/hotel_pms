'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Shirt, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function LaundryOrdersPage() {
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    provider.laundry.getOrders(propertyId)
      .then(res => setOrders(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [propertyId]);

  const renderStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="text-amber-600 font-medium text-xs flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full w-fit"><Clock className="w-3 h-3"/> Pending</span>;
      case 'WASHING':
        return <span className="text-indigo-600 font-medium text-xs flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full w-fit"><Shirt className="w-3 h-3"/> Washing</span>;
      case 'READY':
        return <span className="text-emerald-600 font-medium text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full w-fit"><CheckCircle2 className="w-3 h-3"/> Ready</span>;
      default:
        return <span className="text-slate-500 font-medium text-xs bg-slate-100 px-2 py-1 rounded-full w-fit">{status}</span>;
    }
  };

  if (!propertyId) return <div className="p-8 text-center text-slate-500">Select property</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> All Laundry Orders
            </h1>
          </div>
          <Button onClick={() => router.push('/laundry/orders/new')} className="rounded-xl px-6 h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md">
            + New Order
          </Button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs font-bold">
              <tr>
                <th className="px-6 py-4">Room</th>
                <th className="px-6 py-4">Guest</th>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center p-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className="hover:bg-cyan-50/50 transition-colors group">
                  <td className="px-6 py-5 font-bold text-slate-900 font-mono text-base">{order.room?.number || 'N/A'}</td>
                  <td className="px-6 py-5 font-medium text-slate-700">{order.reservation?.primaryGuest?.firstName} {order.reservation?.primaryGuest?.lastName}</td>
                  <td className="px-6 py-5 font-semibold text-slate-600">{order.serviceType.replace('_', ' ')}</td>
                  <td className="px-6 py-5">{renderStatus(order.status)}</td>
                  <td className="px-6 py-5 font-bold text-slate-900">{formatCurrency(Number(order.totalAmount), order.currency)}</td>
                  <td className="px-6 py-5 text-right">
                    <Button variant="secondary" size="sm" className="rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => router.push(`/laundry/orders/${order.id}`)}>
                      Manage
                    </Button>
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

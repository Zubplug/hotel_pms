'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw, Shirt, CheckCircle2, Clock, ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatCurrency } from '@/lib/utils';
import { ClientOnlyDate } from '@/components/ClientOnlyDate';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function LaundryDashboard() {
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await provider.laundry.getOrders(propertyId);
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [propertyId]);

  if (!propertyId) return <div className="p-8 text-center text-slate-500">Please select a property to view Laundry.</div>;

  const pending = orders.filter(o => o.status === 'PENDING').length;
  const washing = orders.filter(o => o.status === 'WASHING').length;
  const ready = orders.filter(o => o.status === 'READY').length;

  const renderStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="text-amber-600 font-medium text-xs flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3"/> Pending</span>;
      case 'WASHING':
        return <span className="text-indigo-600 font-medium text-xs flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full"><Shirt className="w-3 h-3"/> Washing</span>;
      case 'READY':
        return <span className="text-emerald-600 font-medium text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3"/> Ready</span>;
      default:
        return <span className="text-slate-500 font-medium text-xs bg-slate-100 px-2 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 w-full">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 truncate">
              Laundry Operations
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-lg min-h-[28px]">
              <ClientOnlyDate date={new Date()} format="date" locale="en-GB" options={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }} />
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 md:gap-4 w-full xl:w-auto shrink-0">
            <Button onClick={() => router.push('/laundry/orders/new')} className="h-20 md:h-24 md:w-36 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white shadow hover:shadow-md hover:-translate-y-1 transition-all flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-8 -mt-8 transform group-hover:scale-110 transition-transform"></div>
              <Plus className="w-6 h-6 md:w-7 md:h-7" />
              <span className="font-bold text-sm">New Order</span>
            </Button>
            
            <Button onClick={() => router.push('/laundry/catalog')} variant="outline" className="h-20 md:h-24 md:w-36 rounded-2xl bg-white/80 hover:bg-white text-slate-700 border-white/50 shadow hover:shadow-md hover:-translate-y-1 transition-all flex flex-col gap-2 group">
              <Shirt className="w-6 h-6 md:w-7 md:h-7 text-cyan-600 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Catalog</span>
            </Button>

            <Button onClick={() => router.push('/frontdesk')} variant="outline" className="h-20 md:h-24 md:w-36 rounded-2xl bg-white/80 hover:bg-white text-slate-700 border-white/50 shadow hover:shadow-md hover:-translate-y-1 transition-all flex flex-col gap-2 group">
              <ArrowLeft className="w-6 h-6 md:w-7 md:h-7 text-slate-400 group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold text-sm">Front Desk</span>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 rounded-2xl border border-amber-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-amber-800 font-semibold text-sm uppercase tracking-wider">Pending</span>
              <div className="bg-amber-200/50 p-2 rounded-lg text-amber-700"><Clock className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-amber-950">{pending}</span>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-indigo-800 font-semibold text-sm uppercase tracking-wider">Washing</span>
              <div className="bg-indigo-200/50 p-2 rounded-lg text-indigo-700"><Shirt className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-indigo-950">{washing}</span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col group relative overflow-hidden cursor-pointer" onClick={() => router.push('/laundry/orders')}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-800 font-semibold text-sm uppercase tracking-wider">Ready / Done</span>
              <div className="bg-emerald-200/50 p-2 rounded-lg text-emerald-700"><CheckCircle2 className="w-5 h-5" /></div>
            </div>
            <span className="text-4xl font-extrabold text-emerald-950">{ready}</span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 transform translate-y-full group-hover:translate-y-0 transition-transform"></div>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
              <ArrowRight className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden min-h-[500px]">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shirt className="w-5 h-5 text-cyan-600" /> Recent Laundry Orders
            </h2>
            <Button variant="link" asChild className="text-cyan-600 hover:text-cyan-700 font-bold"><Link href="/laundry/orders">View All Orders</Link></Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-20">
                <Shirt className="w-12 h-12 opacity-20" />
                <p>No recent laundry orders found.</p>
              </div>
            ) : (
              orders.slice(0, 15).map((order) => {
                const guestName = order.reservation?.primaryGuest ? `${order.reservation.primaryGuest.firstName} ${order.reservation.primaryGuest.lastName}` : 'Unknown Guest';
                const initials = guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                
                return (
                  <div key={order.id} className="group bg-white border border-slate-100 hover:border-cyan-100 hover:shadow-md hover:shadow-cyan-50 transition-all rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-900 truncate pr-4">{guestName}</h3>
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md shrink-0">{order.room?.number || 'No Room'}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1">{order.serviceType.replace('_', ' ')}</span>
                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">{formatCurrency(Number(order.totalAmount), order.currency)}</span>
                        <span className="text-slate-300 text-xs">•</span>
                        {renderStatus(order.status)}
                      </div>
                    </div>

                    <div className="shrink-0 pl-2 border-l border-slate-100">
                      <Button size="sm" variant="secondary" className="rounded-xl px-4 bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => router.push(`/laundry/orders/${order.id}`)}>
                        Manage
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

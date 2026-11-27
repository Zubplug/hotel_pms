'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Loader2, RefreshCw, Send, Utensils, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

type OnlineOrdersPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  operatorToken: string;
  isRestaurantTerminal: boolean;
};

const ACTIVE_STATUSES = new Set(['OPEN', 'SUBMITTED', 'IN_SERVICE', 'READY']);

function commerceStatus(order: any): string {
  return String(order.fulfillmentStatus || order.notes?.match(/\[Commerce Status\]\s+([A-Z_]+)/i)?.[1] || order.status || '').toUpperCase();
}

function elapsed(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function nextStatus(status: string): { label: string; value: string } | null {
  switch (status) {
    case 'OPEN':
    case 'SUBMITTED': return { label: 'Start preparing', value: 'IN_SERVICE' };
    case 'IN_SERVICE': return { label: 'Mark ready', value: 'READY' };
    case 'READY': return { label: 'Ready for pickup', value: 'READY_FOR_PICKUP' };
    case 'READY_FOR_PICKUP': return { label: 'Mark collected', value: 'CLOSED' };
    case 'OUT_FOR_DELIVERY': return { label: 'Mark delivered', value: 'CLOSED' };
    default: return null;
  }
}

export function OnlineOrdersPanel({ isOpen, onClose, sessionId, operatorToken, isRestaurantTerminal }: OnlineOrdersPanelProps) {
  const { provider } = useLodgeCoreProvider();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!isRestaurantTerminal || !operatorToken) return;
    setLoading(true);
    try {
      const result = await provider.pos.getActiveOrders(sessionId, operatorToken, 'online_orders');
      if (result.error) throw new Error(result.error);
      setOrders((result.data || []).filter((order: any) => ACTIVE_STATUSES.has(String(order.status || '').toUpperCase())));
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load online orders');
    } finally {
      setLoading(false);
    }
  }, [isRestaurantTerminal, operatorToken, provider.pos, sessionId]);

  useEffect(() => {
    if (!isOpen || !isRestaurantTerminal) return;
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 10000);
    return () => window.clearInterval(timer);
  }, [isOpen, isRestaurantTerminal, loadOrders]);

  const grouped = useMemo(() => ({
    new: orders.filter(order => ['OPEN', 'SUBMITTED'].includes(String(order.status).toUpperCase())),
    preparing: orders.filter(order => commerceStatus(order) === 'IN_SERVICE'),
    ready: orders.filter(order => commerceStatus(order) === 'READY'),
    handover: orders.filter(order => ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(commerceStatus(order))),
  }), [orders]);

  const changeStatus = async (order: any, requestedStatus?: string) => {
    const action = requestedStatus
      ? { label: requestedStatus === 'CANCELLED' ? 'cancelled' : requestedStatus.toLowerCase().replace('_', ' '), value: requestedStatus }
      : nextStatus(commerceStatus(order));
    if (!action) return;
    setUpdating(order.id);
    try {
      const result = await provider.pos.updateOrderStatus(order.id, action.value, undefined, operatorToken);
      if (result.error) throw new Error(result.error);
      toast.success(`${order.orderNumber || 'Online order'} marked ${action.value.toLowerCase().replace('_', ' ')}`);
      await loadOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Could not update order');
    } finally {
      setUpdating(null);
    }
  };

  if (!isOpen || !isRestaurantTerminal) return null;

  const columns = [
    { key: 'new', label: 'New orders', hint: 'Paid and awaiting preparation', color: 'amber', icon: Send },
    { key: 'preparing', label: 'Preparing', hint: 'Kitchen or bar in progress', color: 'indigo', icon: Utensils },
    { key: 'ready', label: 'Ready for service', hint: 'Choose pickup or delivery', color: 'emerald', icon: Check },
    { key: 'handover', label: 'In handover', hint: 'Pickup or delivery in progress', color: 'indigo', icon: Send },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500">Restaurant terminal</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Online orders</h1>
          <p className="mt-1 text-sm text-slate-500">Paid web orders delivered to this outlet. Updates automatically every 10 seconds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadOrders()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close online orders">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-3">
          {columns.map(column => {
            const Icon = column.icon;
            const items = grouped[column.key];
            const accent = column.color === 'amber'
              ? { panel: 'bg-amber-50', text: 'text-amber-600' }
              : column.color === 'indigo'
                ? { panel: 'bg-indigo-50', text: 'text-indigo-600' }
                : { panel: 'bg-emerald-50', text: 'text-emerald-600' };
            return (
              <section key={column.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl ${accent.panel} p-2 ${accent.text}`}><Icon className="h-5 w-5" /></div>
                    <div><h2 className="font-black">{column.label}</h2><p className="text-xs text-slate-400">{column.hint}</p></div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(order => (
                    <article key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-black text-slate-900">{order.orderNumber || 'Online order'}</p><p className="text-xs text-slate-500">{order.displayName || 'Online customer'}</p></div>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><Clock3 className="h-3.5 w-3.5" />{elapsed(order.createdAt)}</span>
                      </div>
                      <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                        {(order.items || []).map((item: any) => (
                          <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{item.quantity} × {item.productName}</span><span className="shrink-0 font-bold text-slate-600">{formatCurrency(Number(item.total || item.unitPrice || 0))}</span></div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-sm font-black">{formatCurrency(Number(order.total || 0))} <span className="font-medium text-emerald-600">Paid</span></span>
                        <div className="flex items-center gap-2">
                          {commerceStatus(order) === 'READY' ? (
                            <>
                              <button onClick={() => void changeStatus(order, 'READY_FOR_PICKUP')} disabled={updating === order.id} className="rounded-lg border border-indigo-200 px-2.5 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">Pickup</button>
                              <button onClick={() => void changeStatus(order, 'OUT_FOR_DELIVERY')} disabled={updating === order.id} className="rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50">Send out</button>
                            </>
                          ) : nextStatus(commerceStatus(order)) && <button onClick={() => void changeStatus(order)} disabled={updating === order.id} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50">{updating === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus(commerceStatus(order))?.label}</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                  {!items.length && <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">No orders in this stage</div>}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Clock, User, Coffee, UtensilsCrossed, Hotel, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Badge } from '@/components/ui/badge';

interface ActiveOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorToken: string;
  sessionId: string;
  staffName: string;
  onOrderSelect: (order: any) => void;
  onViewHistory?: () => void;
  operatorRole?: string;
}

export function ActiveOrdersModal({ isOpen, onClose, operatorToken, sessionId, staffName, operatorRole, onOrderSelect, onViewHistory }: ActiveOrdersModalProps) {
  const { provider } = useLodgeCoreProvider();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'my_orders' | 'all_open'>('my_orders');
  const [isResuming, setIsResuming] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await provider.pos.getActiveOrders(sessionId, operatorToken, filter);
      if (res.error) throw new Error(res.error);
      setOrders(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load active orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && operatorToken) {
      fetchOrders();
    }
  }, [isOpen, operatorToken, filter]);

  const handleResume = async (orderId: string) => {
    setIsResuming(orderId);
    try {
      const res = await provider.pos.getOrder(orderId);
      if (res.error) throw new Error(res.error);
      onOrderSelect(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch order details');
    } finally {
      setIsResuming(null);
    }
  };

  const getOrderIcon = (type: string) => {
    switch (type) {
      case 'TABLE': return <UtensilsCrossed className="w-5 h-5 text-indigo-500" />;
      case 'ROOM_SERVICE': return <Hotel className="w-5 h-5 text-purple-500" />;
      case 'WALK_IN': return <User className="w-5 h-5 text-amber-500" />;
      case 'BAR': return <Coffee className="w-5 h-5 text-orange-500" />;
      case 'TAKEAWAY': return <ShoppingBag className="w-5 h-5 text-emerald-500" />;
      default: return <UtensilsCrossed className="w-5 h-5 text-slate-500" />;
    }
  };

  const formatElapsed = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] lg:max-w-6xl max-h-[85vh] flex flex-col gap-0 p-0 bg-slate-50 border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="p-6 pb-5 bg-white border-b border-slate-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col">
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
                Active Orders
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-1">Select an open order to resume or modify</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setFilter('my_orders')}
                  className={`px-5 py-2 text-sm font-bold rounded-md transition-all ${filter === 'my_orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  My Orders
                </button>
                {(operatorRole === 'CASHIER' || operatorRole === 'MANAGER' || operatorRole === 'ADMIN') && (
                  <button
                    onClick={() => setFilter('all_open')}
                    className={`px-5 py-2 text-sm font-bold rounded-md transition-all ${filter === 'all_open' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    All Open
                  </button>
                )}
              </div>
              <button
                onClick={fetchOrders}
                disabled={isLoading}
                title="Refresh"
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-200"
              >
                <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
              </button>
              {onViewHistory && (
                <button
                  onClick={() => { onClose(); onViewHistory(); }}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 underline underline-offset-2 transition-colors whitespace-nowrap"
                >
                  Order History
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-slate-500 font-medium">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <UtensilsCrossed className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-xl font-bold text-slate-700">No active orders</h3>
              <p className="text-slate-500 mt-2 max-w-md">
                {filter === 'my_orders' 
                  ? "You don't have any open orders right now. Create one from the main screen."
                  : "There are no open orders in this outlet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        {getOrderIcon(order.orderType)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {order.orderType.replace('_', ' ')}
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg leading-tight truncate max-w-[150px]">
                          {order.orderType === 'TABLE' ? `Table ${order.tableName}` : order.displayName || 'No Name'}
                        </h4>
                      </div>
                    </div>
                    <Badge variant={order.status === 'SUBMITTED' ? 'outline' : 'secondary'} className={order.status === 'IN_SERVICE' ? 'bg-amber-100 text-amber-800' : ''}>
                      {order.status === 'SUBMITTED' ? 'DRAFT' : 'IN SVC'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium">Items</span>
                      <span className="font-bold text-slate-800">{order.itemCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium">Total</span>
                      <span className="font-bold text-slate-800">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium">Waiter</span>
                      <span className="font-bold text-slate-800 truncate">{order.waiterName}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium">Time</span>
                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatElapsed(order.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <Button 
                      className="w-full font-bold h-11"
                      onClick={() => handleResume(order.id)}
                      disabled={isResuming === order.id}
                    >
                      {isResuming === order.id ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                      ) : (
                        'Resume Order'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

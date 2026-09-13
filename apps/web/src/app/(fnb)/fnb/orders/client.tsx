'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Clock, Receipt, RefreshCw, X, Utensils, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// --- Type Definitions ---
type OrderStatus = 'SUBMITTED' | 'IN_SERVICE' | 'BILLED' | 'SETTLED' | 'CANCELLED';
type BatchStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';

interface ProductionBatch {
  id: string;
  status: BatchStatus;
  firedAt: string;
  events: { fromStatus: BatchStatus; toStatus: BatchStatus; createdAt: string }[];
}

interface PosOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  table?: { name: string };
  tableNumber?: string;
  serverStaff?: { firstName: string; lastName: string };
  items: { id: string; name: string; quantity: number; price: number; status?: string; modifiers: any[] }[];
  productionBatches: ProductionBatch[];
}

// --- Helpers ---
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

const getElapsedMinutes = (dateString: string) => {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
};

// --- Subcomponents ---
const LiveElapsedTimer = memo(({ startTime, slaWarningMin = 15, slaDangerMin = 25 }: { startTime: string; slaWarningMin?: number; slaDangerMin?: number }) => {
  const [elapsed, setElapsed] = useState(() => getElapsedMinutes(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedMinutes(startTime));
    }, 15000); // Update every 15s is fine for minutes
    return () => clearInterval(interval);
  }, [startTime]);

  let colorClass = 'text-slate-500';
  if (elapsed >= slaDangerMin) colorClass = 'text-rose-600 font-bold';
  else if (elapsed >= slaWarningMin) colorClass = 'text-amber-600 font-bold';

  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", colorClass)}>
      <Clock className="h-3.5 w-3.5" />
      <span>{elapsed}m</span>
    </div>
  );
});
LiveElapsedTimer.displayName = 'LiveElapsedTimer';

const OrderDrawer = ({ order, onClose, onRefresh, businessDate }: { order: PosOrder; onClose: () => void; onRefresh: () => void; businessDate: string }) => {
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!order) return null;

  const handleCancel = async () => {
    if (!cancelReason) return alert('Reason is required');
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/fnb/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason, businessDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to cancel order');
      setShowCancelModal(false);
      onClose();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-rose-600">Cancel Order #{order.orderNumber}</h3>
            </div>
            <div className="p-6">
              <p className="text-sm font-medium text-slate-600 mb-4">
                This will stop active kitchen production. Inventory already consumed may require waste approval. This action cannot be undone.
              </p>
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Reason for Cancellation</label>
              <Input
                autoFocus
                placeholder="e.g. Guest changed mind, Output Error..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="bg-white border-slate-300"
              />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCancelModal(false)} className="text-slate-600 hover:text-slate-900 font-bold">
                Back
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel} 
                disabled={cancelling || !cancelReason}
                className="bg-rose-600 hover:bg-rose-700 font-bold"
              >
                {cancelling ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">{order.orderNumber}</h2>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant="secondary" className="bg-slate-200/60 text-slate-700 hover:bg-slate-200 border-0">{order.status}</Badge>
              <LiveElapsedTimer startTime={order.createdAt} />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700 rounded-full bg-white border border-slate-200 shadow-sm">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Table</p>
              <p className="text-sm font-semibold text-slate-900">{order.table?.name || order.tableNumber || 'Walk-in'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Server</p>
              <p className="text-sm font-semibold text-slate-900">{order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName || ''}` : 'Unassigned'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Utensils className="h-4 w-4 text-slate-400" /> Order Items
            </h3>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={item.id || idx} className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        <span className="text-indigo-600 font-bold mr-2">{item.quantity}x</span>
                        {item.name}
                      </p>
                      {item.modifiers?.map((mod: any) => (
                        <p key={mod.id} className="text-xs font-medium text-slate-500 mt-0.5 ml-6">+ {mod.name}</p>
                      ))}
                    </div>
                    <p className="text-sm font-mono font-bold text-slate-700">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Production Status</h3>
            {order.productionBatches.length === 0 ? (
              <p className="text-xs font-medium text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-100">No KDS batches for this order.</p>
            ) : (
              <div className="space-y-2">
                {order.productionBatches.map(batch => (
                  <div key={batch.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-500 font-mono font-bold">Batch {batch.id.split('-')[0]}</span>
                    <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 font-bold">
                      {batch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Subtotal</span>
            <span className="text-base text-slate-700 font-mono font-semibold">{formatCurrency(Number(order.total))}</span>
          </div>
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
            <span className="text-lg font-bold text-slate-900">Total</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{formatCurrency(Number(order.total))}</span>
          </div>
          
          {['SUBMITTED', 'IN_SERVICE'].includes(order.status) && (
            <Button 
              variant="outline" 
              className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold shadow-sm"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

// --- Main Client ---
export function FnbOrdersClient() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));

  // Polling logic respecting visibility
  useEffect(() => {
    const handleVisibility = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/v1/fnb/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.data?.orders || []);
      setBusinessDate(data.data?.businessDate || new Date().toISOString().slice(0, 10));
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Could not load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!isTabVisible) return;
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [isTabVisible]);

  // Derive Kanban state from authoritative PosProductionBatch data
  const kanbanColumns = useMemo(() => {
    const cols = {
      NEW: [] as PosOrder[],
      PREPARING: [] as PosOrder[],
      READY: [] as PosOrder[],
      SERVED: [] as PosOrder[], // Kept clean and derived from PosOrder IN_SERVICE / batch COMPLETED
    };

    orders.forEach(order => {
      // If the order has no search match, skip
      const q = search.toLowerCase();
      const match = order.orderNumber.toLowerCase().includes(q) ||
        order.table?.name?.toLowerCase().includes(q) ||
        order.tableNumber?.toLowerCase().includes(q) ||
        order.serverStaff?.firstName?.toLowerCase().includes(q);
      
      if (search && !match) return;

      const batches = order.productionBatches || [];
      
      if (batches.length === 0) {
        // No KDS tracking -> New/Served based on general order status
        if (order.status === 'SUBMITTED') cols.NEW.push(order);
        else cols.SERVED.push(order);
        return;
      }

      // Operational visualization logic:
      // If any batch is PREPARING -> Order is Preparing
      // If all batches are READY or COMPLETED -> Order is Ready (if not IN_SERVICE)
      // Else NEW
      const hasPreparing = batches.some(b => b.status === 'PREPARING');
      const allReadyOrCompleted = batches.every(b => b.status === 'READY' || b.status === 'COMPLETED');
      const allCompleted = batches.every(b => b.status === 'COMPLETED');

      if (order.status === 'IN_SERVICE' || allCompleted) {
        cols.SERVED.push(order);
      } else if (hasPreparing) {
        cols.PREPARING.push(order);
      } else if (allReadyOrCompleted) {
        cols.READY.push(order);
      } else {
        cols.NEW.push(order);
      }
    });
    return cols;
  }, [orders, search]);

  const KanbanCard = ({ order }: { order: PosOrder }) => (
    <div 
      onClick={() => setSelectedOrder(order)}
      className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all shadow-sm group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          {order.orderNumber}
        </div>
        <LiveElapsedTimer startTime={order.createdAt} />
      </div>
      <div className="text-sm text-slate-700 font-bold mb-1">
        {order.table?.name || order.tableNumber || 'Walk-in'}
      </div>
      <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
        {order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName || ''}` : 'Unassigned'}
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{order.items.length} items</span>
        <span className="text-sm font-mono font-bold text-slate-800">{formatCurrency(Number(order.total))}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            Operations Monitor
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Live KOT synchronization and order tracking</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search orders, tables..." 
              className="pl-9 bg-white border-slate-200 focus:border-indigo-500 text-sm h-10 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-3 rounded-lg text-xs font-bold", viewMode === 'kanban' ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Board
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-3 rounded-lg text-xs font-bold", viewMode === 'list' ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> List
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {/* NEW / SUBMITTED */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b-2 border-indigo-200">
              <h3 className="font-bold text-sm tracking-widest uppercase text-indigo-700">Submitted</h3>
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-0">{kanbanColumns.NEW.length}</Badge>
            </div>
            <div className="space-y-3">
              {kanbanColumns.NEW.map(o => <KanbanCard key={o.id} order={o} />)}
              {kanbanColumns.NEW.length === 0 && <div className="p-4 text-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">No active orders</div>}
            </div>
          </div>

          {/* PREPARING */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b-2 border-amber-200">
              <h3 className="font-bold text-sm tracking-widest uppercase text-amber-700">Preparing</h3>
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">{kanbanColumns.PREPARING.length}</Badge>
            </div>
            <div className="space-y-3">
              {kanbanColumns.PREPARING.map(o => <KanbanCard key={o.id} order={o} />)}
              {kanbanColumns.PREPARING.length === 0 && <div className="p-4 text-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">No active orders</div>}
            </div>
          </div>

          {/* READY */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-200">
              <h3 className="font-bold text-sm tracking-widest uppercase text-emerald-700">Ready</h3>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">{kanbanColumns.READY.length}</Badge>
            </div>
            <div className="space-y-3">
              {kanbanColumns.READY.map(o => <KanbanCard key={o.id} order={o} />)}
              {kanbanColumns.READY.length === 0 && <div className="p-4 text-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">No active orders</div>}
            </div>
          </div>

          {/* SERVED / COMPLETED */}
          <div className="flex flex-col gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
              <h3 className="font-bold text-sm tracking-widest uppercase text-slate-600">Served / Setup</h3>
              <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-300 border-0">{kanbanColumns.SERVED.length}</Badge>
            </div>
            <div className="space-y-3">
              {kanbanColumns.SERVED.map(o => <KanbanCard key={o.id} order={o} />)}
              {kanbanColumns.SERVED.length === 0 && <div className="p-4 text-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">No active orders</div>}
            </div>
          </div>
        </div>
      ) : (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 text-slate-500 font-bold uppercase tracking-wider text-xs">Order ID</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase tracking-wider text-xs">Table</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase tracking-wider text-xs">Server</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase tracking-wider text-xs">Status</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase tracking-wider text-xs">Elapsed Time</TableHead>
                  <TableHead className="text-right text-slate-500 font-bold uppercase tracking-wider text-xs pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kanbanColumns.NEW.concat(kanbanColumns.PREPARING, kanbanColumns.READY, kanbanColumns.SERVED).map((order) => (
                  <TableRow 
                    key={order.id} 
                    className="hover:bg-slate-50 border-b border-slate-100 cursor-pointer transition-colors"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <TableCell className="pl-6 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-indigo-500" />
                        {order.orderNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700 font-semibold">{order.table?.name || order.tableNumber || 'Walk-in'}</TableCell>
                    <TableCell className="text-slate-600 font-medium">{order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName || ''}` : 'Unassigned'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-bold border-0">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <LiveElapsedTimer startTime={order.createdAt} />
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900 pr-6">
                      {formatCurrency(Number(order.total))}
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                      No active orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Drawer */}
      <OrderDrawer order={selectedOrder as PosOrder} onClose={() => setSelectedOrder(null)} onRefresh={() => fetchOrders(true)} businessDate={businessDate} />
    </div>
  );
}

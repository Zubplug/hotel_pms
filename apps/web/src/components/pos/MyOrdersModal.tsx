'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Loader2, Search, Receipt, FileText,
  CalendarDays, SlidersHorizontal, TrendingUp,
  CheckCircle2, Clock, XCircle, AlertCircle,
  User, UtensilsCrossed, Hotel, Coffee, ShoppingBag,
  ChevronRight, CreditCard, Banknote, ArrowUpDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { ReceiptVerificationModal } from './ReceiptVerificationModal';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorToken: string;
  staffName: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  PAID:      { label: 'Paid',      icon: <CheckCircle2 className="w-3 h-3" />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CLOSED:    { label: 'Closed',    icon: <CheckCircle2 className="w-3 h-3" />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  SUBMITTED: { label: 'Open',      icon: <Clock className="w-3 h-3" />,        className: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_SERVICE:{ label: 'In Service',icon: <Clock className="w-3 h-3" />,        className: 'bg-amber-100 text-amber-700 border-amber-200' },
  VOIDED:    { label: 'Voided',    icon: <XCircle className="w-3 h-3" />,      className: 'bg-slate-100 text-slate-500 border-slate-200' },
  CANCELLED: { label: 'Cancelled', icon: <XCircle className="w-3 h-3" />,      className: 'bg-red-100 text-red-600 border-red-200' },
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  TABLE:        { icon: <UtensilsCrossed className="w-3.5 h-3.5" />, color: 'text-indigo-500' },
  ROOM_SERVICE: { icon: <Hotel className="w-3.5 h-3.5" />,          color: 'text-purple-500' },
  WALK_IN:      { icon: <User className="w-3.5 h-3.5" />,           color: 'text-amber-500' },
  BAR:          { icon: <Coffee className="w-3.5 h-3.5" />,         color: 'text-orange-500' },
  TAKEAWAY:     { icon: <ShoppingBag className="w-3.5 h-3.5" />,    color: 'text-emerald-500' },
};

const PAYMENT_ICON: Record<string, React.ReactNode> = {
  CASH:          <Banknote className="w-3.5 h-3.5 text-emerald-600" />,
  CARD:          <CreditCard className="w-3.5 h-3.5 text-blue-600" />,
  BANK_TRANSFER: <ArrowUpDown className="w-3.5 h-3.5 text-purple-600" />,
  ROOM_CHARGE:   <Hotel className="w-3.5 h-3.5 text-indigo-600" />,
};

const DATE_RANGES = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week',      label: 'This Week' },
];

const STATUS_FILTERS = [
  { value: 'all',       label: 'All Status' },
  { value: 'open',      label: 'Open' },
  { value: 'paid',      label: 'Paid' },
  { value: 'voided',    label: 'Voided' },
];

export function MyOrdersModal({ isOpen, onClose, operatorToken, staffName }: MyOrdersModalProps) {
  const { provider } = useLodgeCoreProvider();
  const [orders, setOrders]               = useState<any[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [dateRange, setDateRange]         = useState('today');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState<string | null>(null);

  const loadReceipt = async (order: any) => {
    setIsLoadingReceipt(order.id);
    try {
      const res = await provider.pos.getReceipt(order.id);
      if (res.error) throw new Error(res.error);
      setSelectedOrder(res.data);
    } catch {
      setSelectedOrder(order);
    } finally {
      setIsLoadingReceipt(null);
    }
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await provider.pos.getServerOrders(dateRange, statusFilter, undefined, operatorToken);
      if (res.error) throw new Error(res.error);
      setOrders((res.data || []).map((order: any) => ({
        ...order,
        id: order.id ?? order.Id,
        orderNumber: order.orderNumber ?? order.OrderNumber ?? '',
        tableNumber: order.tableNumber ?? order.TableNumber ?? '',
        displayName: order.displayName ?? order.DisplayName ?? '',
        status: order.status ?? order.Status ?? '',
        total: Number(order.total ?? order.Total ?? 0),
      })));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && operatorToken) fetchOrders();
  }, [isOpen, operatorToken, dateRange, statusFilter]);

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
      (order.tableNumber  && order.tableNumber.toLowerCase().includes(q))  ||
      (order.displayName  && order.displayName.toLowerCase().includes(q))
    );
  });

  // Summary stats
  const totalRevenue = filteredOrders
    .filter(o => o.status === 'PAID' || o.status === 'CLOSED')
    .reduce((s, o) => s + Number(o.total || 0), 0);
  const paidCount   = filteredOrders.filter(o => o.status === 'PAID' || o.status === 'CLOSED').length;
  const openCount   = filteredOrders.filter(o => o.status === 'SUBMITTED' || o.status === 'IN_SERVICE').length;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getOrderLabel = (order: any) => {
    if (order.orderType === 'TABLE') return `Table ${order.tableNumber || '—'}`;
    return order.displayName || order.orderType?.replace('_', ' ') || '—';
  };

  const statusCfg = (status: string) =>
    STATUS_CONFIG[status] || { label: status, icon: <AlertCircle className="w-3 h-3" />, className: 'bg-slate-100 text-slate-500 border-slate-200' };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[92vw] lg:max-w-7xl max-h-[88vh] flex flex-col gap-0 p-0 bg-slate-50 border-slate-200 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

          {/* ── Header ─────────────────────────────────────────────── */}
          <DialogHeader className="px-8 pt-7 pb-6 bg-white border-b border-slate-100">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">

              {/* Title + stats */}
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
                    Order History
                  </DialogTitle>
                  <p className="text-sm text-slate-500 mt-0.5 font-medium">{staffName}</p>
                </div>

                {/* Inline summary pills */}
                {!isLoading && (
                  <div className="hidden lg:flex items-center gap-3 ml-4 pl-6 border-l border-slate-200">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-black text-emerald-700">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-black text-blue-700">{openCount} open</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-black text-slate-600">{paidCount} paid</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search order, table, name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:ring-indigo-500"
                  />
                </div>

                {/* Date filter pills */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-0.5">
                  {DATE_RANGES.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDateRange(d.value)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${dateRange === d.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Status filter pills */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-0.5">
                  {STATUS_FILTERS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStatusFilter(s.value)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${statusFilter === s.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchOrders}
                  disabled={isLoading}
                  title="Refresh"
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                >
                  <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* ── Body ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-500 font-medium">Loading your orders…</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <p className="font-bold text-slate-600">No orders found</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or search</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider w-32">Time</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Order #</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Type / Location</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Items</th>
                    <th className="py-3.5 px-4 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Payment</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="py-3.5 px-4 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, idx) => {
                    const cfg    = statusCfg(order.status);
                    const typCfg = TYPE_CONFIG[order.orderType] || TYPE_CONFIG['TABLE'];
                    const payMethod = order.payments?.[0]?.method;
                    const isLoadingThis = isLoadingReceipt === order.id;
                    return (
                      <tr
                        key={order.id}
                        className={`group border-b border-slate-100 transition-colors hover:bg-indigo-50/40 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        onClick={() => loadReceipt(order)}
                      >
                        {/* Time */}
                        <td className="py-4 px-6">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {formatTime(order.createdAt)}
                          </span>
                        </td>

                        {/* Order # */}
                        <td className="py-4 px-4">
                          <span className="font-black text-slate-800 tracking-tight">
                            #{order.orderNumber}
                          </span>
                        </td>

                        {/* Type + location */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`${typCfg.color}`}>{typCfg.icon}</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[140px]">
                              {getOrderLabel(order)}
                            </span>
                          </div>
                        </td>

                        {/* Items count */}
                        <td className="py-4 px-4">
                          <span className="text-slate-600 font-medium">
                            {order.items?.length ?? order.itemCount ?? '—'}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-4 px-4 text-right">
                          <span className="font-black text-slate-900 text-base tabular-nums">
                            {formatCurrency(order.total)}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="py-4 px-4">
                          {payMethod ? (
                            <div className="flex items-center gap-1.5">
                              {PAYMENT_ICON[payMethod] ?? <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />}
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                {payMethod.replace('_', ' ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">Unpaid</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${cfg.className}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); loadReceipt(order); }}
                            disabled={!!isLoadingReceipt}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-indigo-200"
                          >
                            {isLoadingThis
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Receipt className="w-3.5 h-3.5" />}
                            Receipt
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Footer summary bar ─────────────────────────────────── */}
          {!isLoading && filteredOrders.length > 0 && (
            <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">
                Showing <span className="font-bold text-slate-600">{filteredOrders.length}</span> order{filteredOrders.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-6">
                <div className="text-xs text-slate-500">
                  Revenue: <span className="font-black text-slate-800">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Open: <span className="font-black text-amber-700">{openCount}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Completed: <span className="font-black text-emerald-700">{paidCount}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <ReceiptVerificationModal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
        />
      )}
    </>
  );
}

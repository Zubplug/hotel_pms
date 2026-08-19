import React from 'react';
import { Receipt, Clock, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  tableName?: string;
  guestCount?: number;
  updatedAt: string;
}

interface PosStaffStripProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
  activeOrderId: string | null;
}

export function PosStaffStrip({ orders, onSelectOrder, activeOrderId }: PosStaffStripProps) {
  if (orders.length === 0) return null;

  return (
    <div className="bg-white border-b border-slate-200 p-3 shrink-0 shadow-sm flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => onSelectOrder(order.id)}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all min-w-[200px] shrink-0 ${
            activeOrderId === order.id
              ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500'
              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            activeOrderId === order.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <Receipt className="w-5 h-5" />
          </div>
          <div className="flex flex-col flex-1 min-w-0 text-left">
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold text-slate-800 text-sm truncate">
                {order.tableName ? `Table ${order.tableName}` : order.orderNumber}
              </span>
              <span className="font-black text-indigo-600 text-sm">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {order.guestCount || 1}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> 
                {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

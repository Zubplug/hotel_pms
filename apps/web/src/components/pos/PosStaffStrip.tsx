import React from 'react';
import { Receipt, Clock, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  tableName?: string;
  tableNumber?: string;
  guestCount?: number;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: any;
}

interface PosStaffStripProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  activeOrderId: string | null;
}

function formatOrderTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PosStaffStrip({ orders, onSelectOrder, activeOrderId }: PosStaffStripProps) {
  if (orders.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {orders.map(order => {
        const isActive = activeOrderId === order.id;
        const label = order.tableName
          ? `Table ${order.tableName}`
          : order.tableNumber
          ? `Table ${order.tableNumber}`
          : order.orderNumber;
        const timeStr = formatOrderTime(order.updatedAt || order.createdAt);

        return (
          <button
            key={order.id}
            onClick={() => onSelectOrder(order)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all min-w-[200px] shrink-0 ${
              isActive
                ? 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-500'
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              <Receipt className="w-4 h-4" />
            </div>
            <div className="flex flex-col flex-1 min-w-0 text-left">
              <div className="flex justify-between items-center gap-2">
                <span className="font-bold text-slate-800 text-sm truncate">{label}</span>
                <span className={`font-black text-sm shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {formatCurrency(order.total)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 font-medium">
                <Users className="w-3 h-3" />
                <span>{order.guestCount || 1}</span>
                <span className="text-slate-300">•</span>
                <Clock className="w-3 h-3" />
                <span>{timeStr}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

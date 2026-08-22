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
    <div
      className="flex gap-2 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {orders.map(order => {
        const isActive = activeOrderId === order.id;
        const label = order.tableName
          ? `T${order.tableName}`
          : order.tableNumber
          ? `T${order.tableNumber}`
          : `#${order.orderNumber?.split('-').pop() || ''}`;

        return (
          <button
            key={order.id}
            onClick={() => onSelectOrder(order)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all shrink-0 touch-manipulation ${
              isActive
                ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Receipt className="w-3 h-3" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-800 text-xs">{label}</span>
                <span className={`font-black text-xs ${isActive ? 'text-indigo-600' : 'text-slate-600'}`}>
                  {formatCurrency(order.total)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                <Users className="w-2.5 h-2.5" />
                <span>{order.guestCount || 1}</span>
                <span className="text-slate-300">·</span>
                <Clock className="w-2.5 h-2.5" />
                <span>{formatOrderTime(order.updatedAt || order.createdAt)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

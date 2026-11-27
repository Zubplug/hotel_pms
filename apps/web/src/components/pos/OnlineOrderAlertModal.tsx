'use client';

import { BellRing, CheckCircle2, Clock3, ExternalLink, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type OnlineOrderAlertModalProps = {
  order: any | null;
  count: number;
  onReview: () => void;
  onDismiss: () => void;
};

export function OnlineOrderAlertModal({ order, count, onReview, onDismiss }: OnlineOrderAlertModalProps) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center bg-slate-950/35 px-4 pt-16 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-label="New online order">
      <div className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 py-6 text-white">
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><BellRing className="h-6 w-6" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Restaurant terminal</p><h2 className="mt-1 text-xl font-black">New online order</h2></div>
            </div>
            <button onClick={onDismiss} className="rounded-full p-1.5 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Dismiss alert"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative mt-5 flex items-center justify-between rounded-2xl bg-black/15 px-4 py-3">
            <div><p className="text-xs font-bold text-indigo-100">{order.orderNumber || 'Online order'}</p><p className="mt-0.5 font-bold">{order.displayName || 'Online customer'}</p></div>
            <div className="text-right"><p className="text-lg font-black">{formatCurrency(Number(order.total || 0))}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Payment received</p></div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold text-slate-500"><Clock3 className="h-4 w-4" />Arrived {count > 1 ? 'with other new orders' : 'just now'}</span><span className="flex items-center gap-1.5 font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />Paid online</span></div>
          <div className="max-h-32 space-y-2 overflow-auto rounded-2xl bg-slate-50 p-4">
            {(order.items || []).slice(0, 4).map((item: any) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{item.quantity} × {item.productName}</span><span className="font-bold text-slate-600">{formatCurrency(Number(item.total || item.unitPrice || 0))}</span></div>)}
            {(order.items || []).length > 4 && <p className="text-xs font-semibold text-slate-400">+ {(order.items || []).length - 4} more item(s)</p>}
          </div>
          <p className="text-xs leading-5 text-slate-500">Review the order, confirm the production queue, and start preparation when your team is ready.</p>
          <div className="flex gap-3"><button onClick={onDismiss} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Dismiss</button><button onClick={onReview} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700">Review order <ExternalLink className="h-4 w-4" /></button></div>
        </div>
      </div>
    </div>
  );
}

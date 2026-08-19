import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, Banknote, Building2, User, Loader2, CheckCircle2 } from 'lucide-react';

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onCharge: (method: string) => Promise<void>;
  isProcessing: boolean;
}

export function ChargeModal({ isOpen, onClose, total, onCharge, isProcessing }: ChargeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-50 border-0 rounded-[2rem]">
        {/* Header Area */}
        <div className="bg-indigo-600 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <DialogTitle className="text-indigo-100 font-bold text-sm tracking-widest uppercase mb-2 relative z-10">Total Amount Due</DialogTitle>
          <div className="text-5xl font-black text-white tracking-tight relative z-10">
            {formatCurrency(total)}
          </div>
          <DialogDescription className="sr-only">Select payment method to complete the transaction.</DialogDescription>
        </div>

        {/* Payment Methods */}
        <div className="p-8 pb-10">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Select Payment Method</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onCharge('CASH')}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-all disabled:opacity-50 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                <Banknote className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">Cash</span>
            </button>
            <button
              onClick={() => onCharge('CARD')}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-all disabled:opacity-50 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">Card</span>
            </button>
            <button
              onClick={() => onCharge('BANK_TRANSFER')}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition-all disabled:opacity-50 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">Transfer</span>
            </button>
            <button
              onClick={() => onCharge('ROOM_CHARGE')}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-200 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all disabled:opacity-50 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                <User className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">Room</span>
            </button>
          </div>
          
          {isProcessing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-[2rem]">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
              <p className="font-bold text-slate-700">Processing Payment...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

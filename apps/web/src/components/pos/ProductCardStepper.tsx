import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ProductCardStepperProps {
  product: Product;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onClick: () => void;
  emoji: string;
}

export function ProductCardStepper({ product, quantity, onIncrement, onDecrement, onClick, emoji }: ProductCardStepperProps) {
  return (
    <div className="relative group rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shadow-sm hover:shadow-xl transition-all duration-200 select-none flex flex-col">
      {/* Clickable Area for Info */}
      <button 
        onClick={onClick}
        className="flex-1 p-4 flex flex-col items-center justify-center text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <span className="text-4xl mb-3 drop-shadow-lg transition-transform group-hover:scale-110">{emoji}</span>
        <p className="font-bold text-slate-100 text-sm leading-snug line-clamp-2">{product.name}</p>
        <p className="font-black text-indigo-400 mt-1">{formatCurrency(product.price)}</p>
      </button>

      {/* Stepper Area */}
      <div className="p-2 border-t border-slate-700/50 bg-slate-900/50">
        {quantity > 0 ? (
          <div className="flex items-center justify-between bg-slate-800 rounded-xl p-1 border border-slate-700 shadow-inner">
            <button 
              onClick={(e) => { e.stopPropagation(); onDecrement(); }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors active:scale-95"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="font-black text-white text-lg w-10 text-center">{quantity}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onIncrement(); }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className="w-full py-2.5 rounded-xl bg-slate-700/50 text-slate-300 font-bold hover:bg-indigo-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-600 hover:border-indigo-500"
          >
            <Plus className="w-4 h-4" />
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

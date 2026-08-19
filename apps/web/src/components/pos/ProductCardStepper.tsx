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
  const isSelected = quantity > 0;

  return (
    <div 
      className={`relative group rounded-2xl overflow-hidden bg-white border transition-all duration-200 select-none flex flex-col ${
        isSelected 
          ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400 ring-offset-1' 
          : 'border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300'
      }`}
    >
      {/* Clickable Area for Info */}
      <button 
        onClick={onClick}
        className="flex-1 p-4 flex flex-col items-center justify-center text-center focus:outline-none"
      >
        <span className="text-4xl mb-3 transition-transform group-hover:scale-110 drop-shadow-sm">{emoji}</span>
        <p className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{product.name}</p>
        <p className="font-black text-indigo-600 mt-1">{formatCurrency(product.price)}</p>
      </button>

      {/* Stepper Area */}
      <div className="p-2 border-t border-slate-100 bg-slate-50/50">
        {quantity > 0 ? (
          <div className="flex items-center justify-between bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
            <button 
              onClick={(e) => { e.stopPropagation(); onDecrement(); }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors active:scale-95"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="font-black text-slate-800 text-lg w-10 text-center">{quantity}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onIncrement(); }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-500 font-bold hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-200 hover:border-indigo-200"
          >
            <Plus className="w-4 h-4" />
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

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

export function ProductCardStepper({
  product,
  quantity,
  onIncrement,
  onDecrement,
  onClick,
  emoji,
}: ProductCardStepperProps) {
  const isSelected = quantity > 0;

  return (
    <div
      className={`relative group flex flex-col bg-white rounded-xl border transition-all duration-150 overflow-hidden select-none ${
        isSelected
          ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400/50'
          : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      {/* Qty badge */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center z-10 shadow">
          {quantity}
        </div>
      )}

      {/* Tap target — emoji + name + price */}
      <button
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center text-center px-2 pt-3 pb-2 gap-1.5 focus:outline-none touch-manipulation"
      >
        <span className="text-3xl leading-none transition-transform group-hover:scale-110">
          {emoji}
        </span>
        <p className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2 px-1">
          {product.name}
        </p>
        <p className="font-black text-indigo-600 text-xs">
          {formatCurrency(product.price)}
        </p>
      </button>

      {/* Stepper */}
      <div className="border-t border-slate-100 bg-slate-50/80 p-1.5">
        {isSelected ? (
          <div className="flex items-center justify-between bg-white rounded-lg px-1 py-0.5 border border-slate-200">
            <button
              onClick={e => { e.stopPropagation(); onDecrement(); }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-500 active:scale-95 transition-all touch-manipulation"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-black text-slate-800 text-sm w-6 text-center">
              {quantity}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onIncrement(); }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 transition-all shadow-sm touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onIncrement(); }}
            className="w-full py-1.5 rounded-lg bg-white text-indigo-600 font-bold text-[11px] hover:bg-indigo-600 hover:text-white active:scale-95 flex items-center justify-center gap-1 border border-slate-200 hover:border-indigo-600 transition-all touch-manipulation"
          >
            <Plus className="w-3 h-3" />
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

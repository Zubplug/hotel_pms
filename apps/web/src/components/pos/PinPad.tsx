import { X } from 'lucide-react';
import React from 'react';

type PinPadProps = {
  pin: string;
  onNumPad: (num: string) => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function PinPad({ pin, onNumPad, onDelete, disabled = false }: PinPadProps) {
  return (
    <div className="mt-auto">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            disabled={disabled}
            onClick={() => onNumPad(num.toString())}
            className="h-16 rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 transition-colors"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          disabled={disabled}
          onClick={() => onNumPad('0')}
          className="h-16 rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 transition-colors"
        >
          0
        </button>
        <button
          disabled={disabled || pin.length === 0}
          onClick={onDelete}
          className="h-16 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 flex items-center justify-center transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

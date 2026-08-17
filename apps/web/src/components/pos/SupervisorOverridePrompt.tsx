'use client';

import { useState } from 'react';
import { ShieldAlert, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

type SupervisorOverridePromptProps = {
  isOpen: boolean;
  actionName: string; // e.g. "Void Order", "Refund Payment"
  onOverrideComplete: (pin: string) => void;
  onCancel: () => void;
};

export function SupervisorOverridePrompt({ isOpen, actionName, onOverrideComplete, onCancel }: SupervisorOverridePromptProps) {
  const [pin, setPin] = useState('');
  
  if (!isOpen) return null;

  const handleNumPad = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length === 4) {
      onOverrideComplete(pin);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center">
        
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Supervisor Override Required</h2>
        <p className="text-slate-500 text-center mb-8">
          Enter a manager PIN to authorize <strong>{actionName}</strong>.
        </p>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-5 h-5 rounded-full transition-colors ${
                i < pin.length ? 'bg-red-600' : 'bg-slate-200'
              }`} 
            />
          ))}
        </div>

        {/* NumPad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumPad(num.toString())}
              className="h-16 rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              {num}
            </button>
          ))}
          <button
            onClick={onCancel}
            className="h-16 rounded-2xl bg-slate-50 text-slate-500 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => handleNumPad('0')}
            className="h-16 rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            0
          </button>
          <button
            disabled={pin.length < 4}
            onClick={handleSubmit}
            className="h-16 rounded-2xl bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 flex items-center justify-center transition-colors font-semibold"
          >
            GO
          </button>
        </div>
      </div>
    </div>
  );
}

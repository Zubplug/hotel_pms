import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface ActionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  autoCloseMs?: number;
}

export function ActionSuccessModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = 'Continue',
  onAction,
  autoCloseMs,
}: ActionSuccessModalProps) {
  useEffect(() => {
    if (isOpen && autoCloseMs) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-200">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-800 mb-2">{title}</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">
            {message}
          </p>
          
          <button
            onClick={() => {
              if (onAction) onAction();
              onClose();
            }}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold text-lg transition-all shadow-md shadow-emerald-200"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

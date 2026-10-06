import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ActionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  autoCloseMs?: number;
  meta?: Array<{ label: string; value: string }>;
  statusText?: string;
}

export function ActionSuccessModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = 'Continue',
  onAction,
  autoCloseMs,
  meta,
  statusText,
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
          <p className="text-slate-500 font-medium leading-relaxed mb-5">
            {message}
          </p>

          {meta && meta.length > 0 && (
            <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 mb-4 text-left">
              {meta.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-bold text-slate-800 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {statusText && (
            <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 mb-6 text-xs font-bold text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {statusText}
            </div>
          )}
          
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

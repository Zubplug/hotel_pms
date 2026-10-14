'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type EmployeePortalDialogContextValue = { close: () => void };
const EmployeePortalDialogContext = React.createContext<EmployeePortalDialogContextValue | null>(null);

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  const close = React.useCallback(() => onOpenChange?.(false), [onOpenChange]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <EmployeePortalDialogContext.Provider value={{ close }}>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {children}
      </div>
    </EmployeePortalDialogContext.Provider>
  );
}

export function DialogContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const context = React.useContext(EmployeePortalDialogContext);

  return (
    <div
      data-employee-portal-dialog="true"
      className={`relative max-h-[calc(100dvh-1.5rem)] w-full min-w-0 overflow-y-auto rounded-t-3xl border border-slate-700 bg-[#0b1624] p-4 text-slate-100 shadow-2xl shadow-black/50 sm:max-w-[calc(100%-2rem)] sm:rounded-2xl ${className}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
      {context && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close dialog"
          onClick={context.close}
          className="absolute right-2 top-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export { DialogDescription, DialogFooter, DialogHeader, DialogTitle };

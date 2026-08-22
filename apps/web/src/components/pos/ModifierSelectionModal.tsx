'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { toast } from 'sonner';

interface ModifierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
  onConfirm: (product: any, selectedModifiers: any[]) => void;
}

export function ModifierSelectionModal({ isOpen, onClose, product, onConfirm }: ModifierSelectionModalProps) {
  const { provider } = useLodgeCoreProvider();
  const [modifiers, setModifiers] = useState<any[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      const fetchModifiers = async () => {
        setIsLoading(true);
        setFetchError(null);
        setModifiers([]);
        setSelectedModifiers(new Set());
        try {
          const res = await provider.pos.getProductModifiers(product.id);
          // Handle both IPC error envelope and network errors
          if (res?.error) {
            setFetchError(res.error);
            toast.error(`Could not load modifiers: ${res.error}`);
          } else if (res?.data) {
            setModifiers(res.data);
          } else {
            // No data and no error — treat as empty modifier list
            setModifiers([]);
          }
        } catch (e: any) {
          const msg = e?.message || 'Failed to load modifiers';
          setFetchError(msg);
          toast.error(msg);
          console.error('[ModifierModal] Failed to fetch product modifiers:', e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchModifiers();
    }
  }, [isOpen, product, provider]);

  if (!isOpen || !product) return null;

  const toggleModifier = (modId: string) => {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedMods = modifiers.filter((m) => selectedModifiers.has(m.id));
    onConfirm(product, selectedMods);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Customize</h3>
            <p className="text-slate-500 text-sm">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors touch-manipulation">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading modifiers...</span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="font-semibold text-slate-700">Could not load modifiers</p>
              <p className="text-sm text-slate-400">{fetchError}</p>
              <p className="text-xs text-slate-400 mt-1">You can still add the item without modifiers.</p>
            </div>
          ) : modifiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8">
              <span className="text-slate-400 font-medium">No modifiers available.</span>
              <span className="text-slate-300 text-sm">The item will be added as-is.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {modifiers.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => toggleModifier(mod.id)}
                  className={
                    'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all touch-manipulation ' +
                    (selectedModifiers.has(mod.id)
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700')
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        'w-5 h-5 rounded-md flex items-center justify-center ' +
                        (selectedModifiers.has(mod.id) ? 'bg-indigo-600 text-white' : 'border-2 border-slate-300')
                      }
                    >
                      {selectedModifiers.has(mod.id) && <Check className="w-3 h-3" />}
                    </div>
                    <span className="font-medium">{mod.name}</span>
                  </div>
                  {Number(mod.price) > 0 && (
                    <span className="font-semibold">+{formatCurrency(Number(mod.price))}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 font-bold touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white touch-manipulation"
          >
            {selectedModifiers.size > 0
              ? `Add to Order (+${formatCurrency(modifiers.filter(m => selectedModifiers.has(m.id)).reduce((s, m) => s + Number(m.price), 0))})`
              : 'Add to Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}

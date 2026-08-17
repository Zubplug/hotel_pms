'use client';

import { useState } from 'react';
import { X, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface CheckSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  items: any[];
  onSplitComplete: () => void;
  userId: string;
}

export function CheckSplitModal({ isOpen, onClose, orderId, items, onSplitComplete, userId }: CheckSplitModalProps) {
  const { provider } = useLodgeCoreProvider();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // Filter items that are not yet assigned to a separate check
  // In a real app we'd distinguish which check an item belongs to.
  // For this UI, we just allow selecting items to move to a new check.
  const availableItems = items; 

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSplit = async () => {
    if (selectedItemIds.size === 0) return;
    setIsProcessing(true);
    try {
      await provider.pos.splitCheck(orderId, Array.from(selectedItemIds), userId);
      onSplitComplete();
      onClose();
    } catch (e) {
      console.error("Failed to split check", e);
      alert("Failed to split check. See console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedTotal = availableItems
    .filter(i => selectedItemIds.has(i.id))
    .reduce((sum, i) => sum + (i.price * i.quantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-lg">Split Check</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Main Check */}
          <div className="flex-1 border-r border-slate-100 flex flex-col">
            <div className="p-3 bg-slate-50 font-semibold text-slate-600 text-sm border-b border-slate-100 text-center">
              Original Order
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
              {availableItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={
                    'p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ' +
                    (selectedItemIds.has(item.id) 
                      ? 'border-indigo-200 bg-indigo-50/50 opacity-50' 
                      : 'border-slate-200 hover:border-slate-300')
                  }
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <div className="text-xs text-slate-500">Qty: {item.quantity}</div>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* New Check */}
          <div className="flex-1 flex flex-col bg-slate-50/50">
            <div className="p-3 bg-indigo-50 text-indigo-800 font-semibold text-sm border-b border-indigo-100 text-center flex items-center justify-center gap-2">
              <ArrowRight className="w-4 h-4" />
              New Check B
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableItems.filter(i => selectedItemIds.has(i.id)).map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-indigo-200 bg-white flex justify-between items-center shadow-sm">
                  <div>
                    <span className="font-medium text-indigo-900">{item.name}</span>
                    <div className="text-xs text-indigo-500">Qty: {item.quantity}</div>
                  </div>
                  <span className="font-semibold text-indigo-700">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              {selectedItemIds.size === 0 && (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm p-8 text-center">
                  Select items from the original order to move them to a new check.
                </div>
              )}
            </div>
            
            {/* Total Footer */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-500 font-medium">New Check Total</span>
                <span className="font-bold text-xl text-indigo-700">{formatCurrency(selectedTotal)}</span>
              </div>
              <Button 
                onClick={handleSplit}
                disabled={selectedItemIds.size === 0 || isProcessing}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base font-bold"
              >
                {isProcessing ? 'Processing...' : 'Create Split Check'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

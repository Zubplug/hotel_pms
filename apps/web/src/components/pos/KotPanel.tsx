'use client';

import { useState } from 'react';
import { ChefHat, Flame, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KotItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  course?: number;
  kitchenStatus?: string;
  modifiers?: { name: string; price: number }[];
}

interface KotPanelProps {
  items: KotItem[];
  onFire: (itemIds: string[]) => Promise<void>;
  isDisabled?: boolean;
}

const KITCHEN_STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: 'Pending',   color: 'bg-slate-100 text-slate-600',  icon: Clock },
  SENT:       { label: 'Sent',      color: 'bg-amber-100 text-amber-700',  icon: ChefHat },
  PREPARING:  { label: 'Preparing', color: 'bg-orange-100 text-orange-700', icon: Flame },
  READY:      { label: 'Ready',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  VOID:       { label: 'Voided',    color: 'bg-red-100 text-red-600',      icon: AlertCircle },
};

export function KotPanel({ items, onFire, isDisabled }: KotPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFiring, setIsFiring] = useState(false);

  const pendingItems = items.filter(
    (i) => !i.kitchenStatus || i.kitchenStatus === 'PENDING'
  );
  const sentItems = items.filter(
    (i) => i.kitchenStatus && i.kitchenStatus !== 'PENDING'
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pendingItems.map((i) => i.id)));
  };

  const handleFire = async () => {
    const toFire = selectedIds.size > 0
      ? Array.from(selectedIds)
      : pendingItems.map((i) => i.id);

    if (toFire.length === 0) return;
    setIsFiring(true);
    try {
      await onFire(toFire);
      setSelectedIds(new Set());
    } finally {
      setIsFiring(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-sm tracking-wide uppercase text-slate-200">Kitchen</span>
        </div>
        {pendingItems.length > 0 && (
          <button
            onClick={selectAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
          >
            Select All
          </button>
        )}
      </div>

      {/* Pending Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pendingItems.length === 0 && sentItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-8">
            <ChefHat className="w-10 h-10 opacity-20" />
            <p className="text-sm">No items to fire</p>
          </div>
        )}

        {pendingItems.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1">
              Pending — Not Sent
            </p>
            {pendingItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-white leading-tight block">{item.name}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          + {item.modifiers.map((m) => m.name).join(', ')}
                        </span>
                      )}
                      {item.course && (
                        <span className="text-xs text-indigo-400 mt-0.5 block">Course {item.course}</span>
                      )}
                    </div>
                    <span className="ml-3 text-sm font-bold text-amber-400 tabular-nums">×{item.quantity}</span>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {sentItems.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mt-4 mb-1">
              Sent to Kitchen
            </p>
            {sentItems.map((item) => {
              const meta = KITCHEN_STATUS_META[item.kitchenStatus || 'SENT'] ?? KITCHEN_STATUS_META.SENT;
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-slate-300 block">{item.name}</span>
                    <span className="text-xs text-slate-500">×{item.quantity}</span>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Fire Button */}
      <div className="p-3 border-t border-slate-700">
        <Button
          onClick={handleFire}
          disabled={isDisabled || isFiring || pendingItems.length === 0}
          className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isFiring ? (
            <span className="flex items-center gap-2">
              <span className="animate-pulse">Sending...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Flame className="w-5 h-5" />
              {selectedIds.size > 0
                ? `Fire ${selectedIds.size} Item${selectedIds.size > 1 ? 's' : ''}`
                : `Fire All (${pendingItems.length})`}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

import React from 'react';

interface StockStatusBadgeProps {
  quantity: number;
  reorderLevel?: number | null;
}

export function StockStatusBadge({ quantity, reorderLevel }: StockStatusBadgeProps) {
  if (quantity < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        NEGATIVE
      </span>
    );
  }
  
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        OUT
      </span>
    );
  }
  
  if (reorderLevel !== undefined && reorderLevel !== null && quantity <= reorderLevel) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
        LOW
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      OK
    </span>
  );
}

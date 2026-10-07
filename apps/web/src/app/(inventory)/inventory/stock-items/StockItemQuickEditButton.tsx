'use client';

import { useState } from 'react';
import { Edit } from 'lucide-react';
import { StockItemQuickEditDialog } from './StockItemQuickEditDialog';

type StockItemForEdit = {
  id: string; name: string; sku: string | null; barcode: string | null;
  baseUnit: string; stockType: string; reorderLevel: number | null;
  isActive: boolean; quantityOnHand: number; costPrice: number; purchaseUnit: string; unitsInBase: number; purchaseCost: number | null; warehouseName: string;
};

export function StockItemQuickEditButton({ item }: { item: StockItemForEdit }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white"><Edit className="h-3.5 w-3.5" />Edit</button>
    <StockItemQuickEditDialog item={item} open={open} onOpenChange={setOpen} />
  </>;
}

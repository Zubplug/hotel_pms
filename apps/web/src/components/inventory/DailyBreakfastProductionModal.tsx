'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Loader2,
  Package,
  Layers,
  ReceiptText,
} from 'lucide-react';
import { formatUnit } from '@/lib/inventory/units';

interface RequisitionItem {
  stockItemId: string;
  stockItemName: string;
  sku: string;
  requiredQuantity: number;
  baseUnit: string;
  currentStock: number;
  unitCost: number;
  totalCost: number;
}

interface DailyBreakfastProductionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  onSuccess?: () => void;
}

function money(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DailyBreakfastProductionModal({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: DailyBreakfastProductionModalProps) {
  const [covers, setCovers] = useState<number>(0);
  const [hasInitializedCovers, setHasInitializedCovers] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [operationId, setOperationId] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState<{
    recipe: any;
    items: RequisitionItem[];
    totalEstimatedCost: number;
    entitledInHouseCovers?: number;
    availableRecipes?: { id: string; posProduct?: { id: string; name: string } }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Reset initialization when modal closes
  useEffect(() => {
    if (!open) {
      setSuccessInfo(null);
      setError(null);
      setHasInitializedCovers(false);
      setCovers(0);
      setOperationId('');
      setSelectedRecipeId('');
    }
  }, [open]);

  // Fetch requisition preview whenever covers, recipe, or modal status changes
  useEffect(() => {
    if (!open) return;

    let active = true;
    async function fetchPreview() {
      setLoadingPreview(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (covers > 0) queryParams.set('covers', covers.toString());
        if (selectedRecipeId) queryParams.set('recipeId', selectedRecipeId);
        if (propertyId) queryParams.set('propertyId', propertyId);

        const res = await fetch(`/api/v1/inventory/breakfast-buffet/produce?${queryParams.toString()}`);
        const body = await res.json();

        if (!active) return;
        if (!res.ok) {
          throw new Error(body.error || 'Failed to calculate requisition preview');
        }

        setPreviewData(body.data);

        // Seed initial covers count with actual entitled in-house covers
        if (!hasInitializedCovers) {
          const liveCovers = typeof body.data?.entitledInHouseCovers === 'number'
            ? Math.max(1, body.data.entitledInHouseCovers)
            : 1;
          setCovers(liveCovers);
          setHasInitializedCovers(true);
        }

        if (!selectedRecipeId && body.data?.recipe?.id) {
          setSelectedRecipeId(body.data.recipe.id);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Error fetching batch requisition');
      } finally {
        if (active) setLoadingPreview(false);
      }
    }

    const timer = setTimeout(() => {
      void fetchPreview();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [covers, open, propertyId, selectedRecipeId, hasInitializedCovers]);

  // Check if any ingredients have insufficient stock
  const deficits = useMemo(() => {
    if (!previewData?.items) return [];
    return previewData.items.filter(
      (item) => item.currentStock < item.requiredQuantity,
    );
  }, [previewData]);

  const hasDeficit = deficits.length > 0;

  async function handleProduce() {
    if (hasDeficit || submitting || !covers || covers < 1 || !selectedRecipeId) return;
    setSubmitting(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const stableOperationId = operationId || `BUFFET_PROD_${crypto.randomUUID()}`;
      setOperationId(stableOperationId);
      const res = await fetch('/api/v1/inventory/breakfast-buffet/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          covers,
          recipeId: selectedRecipeId || previewData?.recipe?.id,
          operationId: stableOperationId,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Production batch submission failed');
      }

      setSuccessInfo(
        `Batch production recorded for ${covers} covers! Decremented raw ingredients and posted COGS Journal Entry (${money(previewData?.totalEstimatedCost || 0)}).`,
      );
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to record breakfast buffet production');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ChefHat className="h-6 w-6" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Production Recipe
              </label>
              <select
                value={selectedRecipeId}
                onChange={(event) => {
                  setSelectedRecipeId(event.target.value);
                  setPreviewData(null);
                  setHasInitializedCovers(false);
                }}
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="">Select an active recipe</option>
                {(previewData?.availableRecipes || []).map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.posProduct?.name || recipe.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Daily Breakfast Buffet Production
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-500">
                Kitchen Batch Preparation · Raw Stock Deduction & COGS Accounting
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
          {/* Controls: Covers Input */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Planned Buffet Covers
                </label>
                {previewData?.recipe?.posProduct?.name && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {previewData.recipe.posProduct.name}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={covers || ''}
                  onChange={(e) => setCovers(Math.max(1, parseInt(e.target.value) || 0))}
                  className="h-10 text-base font-bold text-slate-900"
                />
                <span className="text-xs font-semibold text-slate-500">Covers</span>
              </div>

              {/* Entitled In-House Covers Badge */}
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-xs text-indigo-900">
                <span>
                  In-House Entitled: <strong>{previewData?.entitledInHouseCovers ?? '…'}</strong>
                </span>
                {typeof previewData?.entitledInHouseCovers === 'number' && (
                  <button
                    type="button"
                    onClick={() => setCovers(Math.max(1, previewData.entitledInHouseCovers || 1))}
                    className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline"
                  >
                    Sync ({previewData.entitledInHouseCovers})
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Estimated Batch Cost (COGS)
              </span>
              <div className="mt-1">
                <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {loadingPreview ? (
                    <span className="text-slate-400">Calculating…</span>
                  ) : (
                    money(previewData?.totalEstimatedCost || 0)
                  )}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ReceiptText className="h-3.5 w-3.5 text-indigo-500" />
                  Posts Debit GL 5000 / Credit GL 1300
                </p>
              </div>
            </div>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <div>{error}</div>
            </div>
          )}

          {successInfo && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <div>{successInfo}</div>
            </div>
          )}

          {hasDeficit && !successInfo && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <strong>Stock Deficit Warning:</strong> {deficits.length} ingredient(s) have
                insufficient stock on hand. You must transfer or replenish stock before executing batch
                production.
              </div>
            </div>
          )}

          {/* Requisition Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Layers className="h-3.5 w-3.5 text-orange-500" />
                Required Ingredients Breakdown
              </span>
              {loadingPreview && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>

            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-right">Required</th>
                  <th className="px-4 py-2.5 text-right">Available</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5 text-right">Value (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {previewData?.items?.length ? (
                  previewData.items.map((item) => {
                    const isShort = item.currentStock < item.requiredQuantity;
                    return (
                      <tr key={item.stockItemId} className={isShort ? 'bg-red-50/40' : undefined}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{item.stockItemName}</p>
                          <p className="text-[10px] text-slate-400">SKU: {item.sku || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {item.requiredQuantity.toLocaleString()} {formatUnit(item.baseUnit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span
                            className={
                              isShort
                                ? 'font-bold text-red-600'
                                : 'text-slate-600'
                            }
                          >
                            {item.currentStock.toLocaleString()} {formatUnit(item.baseUnit)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isShort ? (
                            <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Deficit ({(item.requiredQuantity - item.currentStock).toFixed(1)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Ready
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {money(item.totalCost)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {loadingPreview ? 'Loading ingredients recipe…' : 'No ingredients found for breakfast recipe.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-300"
          >
            Cancel
          </Button>

          <Button
            onClick={handleProduce}
            disabled={hasDeficit || submitting || loadingPreview || !selectedRecipeId || !previewData?.items?.length}
            className="rounded-xl bg-orange-600 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deducting Stock & Posting GL…
              </>
            ) : hasDeficit ? (
              'Insufficient Raw Stock'
            ) : (
              `Confirm & Produce (${covers} Covers)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

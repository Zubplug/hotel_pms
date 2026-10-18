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
  Search,
  ChevronDown,
  Check,
} from 'lucide-react';
import { formatUnit } from '@/lib/inventory/units';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

interface RecipeSelection {
  recipeId: string;
  portionsPerGuest: number;
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
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeSelection[]>([]);
  const [openRecipePicker, setOpenRecipePicker] = useState<number | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [operationId, setOperationId] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState<{
    recipe: any;
    items: RequisitionItem[];
    totalEstimatedCost: number;
    entitledInHouseCovers?: number;
    availableRecipes?: { id: string; posProduct?: { id: string; name: string; category?: { name: string; outlet?: { name: string } } } }[];
    breakfastCategories?: { id: string; name: string }[];
    recipes?: { id: string; posProduct?: { name: string } }[];
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
      setSelectedRecipes([]);
      setOpenRecipePicker(null);
      setRecipeSearch('');
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
        const validSelections = selectedRecipes.filter((selection) => selection.recipeId);
        if (validSelections.length) queryParams.set('recipes', JSON.stringify(validSelections));
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

        if (!selectedRecipes.length && body.data?.availableRecipes?.[0]?.id) {
          setSelectedRecipes([{ recipeId: body.data.availableRecipes[0].id, portionsPerGuest: 1 }]);
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
  }, [covers, open, propertyId, selectedRecipes, hasInitializedCovers]);

  // Check if any ingredients have insufficient stock
  const deficits = useMemo(() => {
    if (!previewData?.items) return [];
    return previewData.items.filter(
      (item) => item.currentStock < item.requiredQuantity,
    );
  }, [previewData]);

  const hasDeficit = deficits.length > 0;
  const filteredRecipes = useMemo(() => {
    const query = recipeSearch.trim().toLowerCase();
    if (!query) return previewData?.availableRecipes || [];
    return (previewData?.availableRecipes || []).filter((recipe) =>
      `${recipe.posProduct?.name || ''} ${recipe.posProduct?.category?.name || ''} ${recipe.posProduct?.category?.outlet?.name || ''}`.toLowerCase().includes(query),
    );
  }, [previewData?.availableRecipes, recipeSearch]);

  async function handleProduce() {
    const validSelections = selectedRecipes.filter((selection) => selection.recipeId);
    if (hasDeficit || submitting || !covers || covers < 1 || !validSelections.length || validSelections.length !== selectedRecipes.length) return;
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
          recipes: validSelections,
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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/50 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 sm:text-2xl">
                Breakfast Buffet Production
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                Build a breakfast combo from multiple production recipes. Quantities are calculated per guest, deducted from the kitchen warehouse, and posted to COGS.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-7">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Complimentary breakfast menus</p>
                  {(previewData?.breakfastCategories || []).map((category) => (
                    <span key={category.id} className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">{category.name}</span>
                  ))}
                </div>
                <p className="mt-1 text-sm text-slate-500">Add one or more breakfast recipes. Each recipe can be produced more than once per guest for combos and plated selections.</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-lg" onClick={() => setSelectedRecipes([...selectedRecipes, { recipeId: '', portionsPerGuest: 1 }])}>
                Add recipe
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {selectedRecipes.map((selection, index) => (
                <div key={`${index}-${selection.recipeId}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
                  <Popover open={openRecipePicker === index} onOpenChange={(open) => { setOpenRecipePicker(open ? index : null); if (!open) setRecipeSearch(''); }}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-10 min-w-0 justify-between border-slate-300 bg-white px-3 text-left font-normal text-slate-800">
                        <span className="truncate">
                          {previewData?.availableRecipes?.find((recipe) => recipe.id === selection.recipeId)?.posProduct?.name || 'Select complimentary menu'}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[30rem] max-w-[calc(100vw-2rem)] p-2">
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
                        <Search className="h-4 w-4 text-slate-400" />
                        <Input autoFocus value={recipeSearch} onChange={(event) => setRecipeSearch(event.target.value)} placeholder="Search breakfast menus..." className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
                      </div>
                      <div className="mt-2 max-h-64 overflow-y-auto">
                        {filteredRecipes.length ? filteredRecipes.map((recipe) => {
                          const isSelected = recipe.id === selection.recipeId;
                          return (
                            <button key={recipe.id} type="button" onClick={() => { setSelectedRecipes(selectedRecipes.map((item, itemIndex) => itemIndex === index ? { ...item, recipeId: recipe.id } : item)); setOpenRecipePicker(null); setRecipeSearch(''); }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-orange-50">
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300">{isSelected && <Check className="h-3 w-3 text-orange-600" />}</span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-800">{recipe.posProduct?.name || recipe.id}</span>
                                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{recipe.posProduct?.category?.name || 'Breakfast menu'}{recipe.posProduct?.category?.outlet?.name ? ` · ${recipe.posProduct.category.outlet.name}` : ''}</span>
                              </span>
                            </button>
                          );
                        }) : <p className="px-3 py-6 text-center text-sm text-slate-500">No breakfast menu matches your search.</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    Portions / guest
                    <Input type="number" min={0.01} step={0.01} value={selection.portionsPerGuest} onChange={(event) => setSelectedRecipes(selectedRecipes.map((item, itemIndex) => itemIndex === index ? { ...item, portionsPerGuest: Math.max(0.01, Number(event.target.value) || 1) } : item))} className="h-10 w-24 bg-white text-sm font-semibold" />
                  </label>
                  <Button type="button" variant="ghost" className="text-slate-500 hover:text-red-600" onClick={() => setSelectedRecipes(selectedRecipes.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
              ))}
              {!selectedRecipes.length && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Add a recipe to start the production plan.</p>}
            </div>
          </section>
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
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Layers className="h-3.5 w-3.5 text-orange-500" />
                Required Ingredients Breakdown
              </span>
              {loadingPreview && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>

            <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
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
            disabled={hasDeficit || submitting || loadingPreview || !selectedRecipes.length || selectedRecipes.some((selection) => !selection.recipeId) || !previewData?.items?.length}
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

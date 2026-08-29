'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Pencil, X, Check, ChevronRight, ListFilter, Utensils } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductionStation = 'KITCHEN' | 'BAR' | 'DIRECT' | 'NONE';

interface Category {
  id: string;
  name: string;
  productionStation: ProductionStation;
  isActive: boolean;
  sortOrder: number;
}

interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number | string;
  taxRate: number | string;
  isActive: boolean;
  productionStation: ProductionStation | null;
}

// ─── Station config ───────────────────────────────────────────────────────────

const STATION_CONFIG: Record<
  ProductionStation,
  { label: string; icon: string; bg: string; text: string; border: string; desc: string }
> = {
  KITCHEN: {
    label: 'KITCHEN',
    icon: '🔥',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    desc: 'Items go to kitchen display',
  },
  BAR: {
    label: 'BAR',
    icon: '🍺',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    desc: 'Items go to bar display',
  },
  DIRECT: {
    label: 'DIRECT',
    icon: '⚡',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Served immediately, no ticket',
  },
  NONE: {
    label: 'NONE',
    icon: '📦',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    desc: 'No production required',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StationBadge({
  station,
  inherited = false,
  override = false,
  small = false,
}: {
  station: ProductionStation;
  inherited?: boolean;
  override?: boolean;
  small?: boolean;
}) {
  const cfg = STATION_CONFIG[station];
  const sizeClasses = small ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses} ${inherited ? 'opacity-60' : ''}`}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
      {override && <span className="ml-0.5 text-amber-500">⭐</span>}
    </span>
  );
}

function CategoryEditModal({
  category,
  onClose,
  onSave,
}: {
  category: Category;
  onClose: () => void;
  onSave: (station: ProductionStation) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ProductionStation>(category.productionStation);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Change Production Station</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Category: <span className="font-medium text-slate-700">{category.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {(Object.keys(STATION_CONFIG) as ProductionStation[]).map((station) => {
            const cfg = STATION_CONFIG[station];
            const isSelected = selected === station;
            return (
              <label
                key={station}
                className={`flex items-center gap-4 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${cfg.border} ${cfg.bg}`
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="cat-station"
                  value={station}
                  checked={isSelected}
                  onChange={() => setSelected(station)}
                  className="sr-only"
                />
                <span className="text-xl">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-semibold text-sm ${isSelected ? cfg.text : 'text-slate-800'}`}>
                    {station}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? `border-current ${cfg.text}` : 'border-slate-300'
                  }`}
                >
                  {isSelected && <div className={`w-2 h-2 rounded-full ${cfg.text.replace('text-', 'bg-')}`} />}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selected === category.productionStation}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductEditModal({
  product,
  categoryStation,
  canEditStation = true,
  onClose,
  onSave,
}: {
  product: Product;
  categoryStation: ProductionStation;
  canEditStation?: boolean;
  onClose: () => void;
  onSave: (station: ProductionStation | null, price: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ProductionStation | 'INHERIT'>(
    product.productionStation ?? 'INHERIT'
  );
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(String(product.price));

  const initialValue = product.productionStation ?? 'INHERIT';
  const hasChanged = selected !== initialValue || Number(price) !== Number(product.price);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected === 'INHERIT' ? null : selected, Number(price));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const cfg = STATION_CONFIG[categoryStation];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Product Settings</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Product: <span className="font-medium text-slate-700">{product.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Selling price</label>
          <input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-slate-400">Cashier changes are sent to Accountant review, then Manager approval before going live.</p>
        </div>

        {/* Options */}
        {canEditStation ? <div className="p-6 space-y-3">
          {/* Inherit option */}
          <label
            className={`flex items-center gap-4 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              selected === 'INHERIT'
                ? 'border-indigo-300 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="prod-station"
              value="INHERIT"
              checked={selected === 'INHERIT'}
              onChange={() => setSelected('INHERIT')}
              className="sr-only"
            />
            <span className="text-xl">↩️</span>
            <div className="flex-1 min-w-0">
              <span className={`font-semibold text-sm ${selected === 'INHERIT' ? 'text-indigo-700' : 'text-slate-800'}`}>
                Inherit from category
              </span>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                Currently:&nbsp;
                <span className={`inline-flex items-center gap-1 font-medium ${cfg.text}`}>
                  {cfg.icon} {categoryStation}
                </span>
              </p>
            </div>
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                selected === 'INHERIT' ? 'border-indigo-500' : 'border-slate-300'
              }`}
            >
              {selected === 'INHERIT' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
            </div>
          </label>

          {(Object.keys(STATION_CONFIG) as ProductionStation[]).map((station) => {
            const stCfg = STATION_CONFIG[station];
            const isSelected = selected === station;
            return (
              <label
                key={station}
                className={`flex items-center gap-4 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${stCfg.border} ${stCfg.bg}`
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="prod-station"
                  value={station}
                  checked={isSelected}
                  onChange={() => setSelected(station)}
                  className="sr-only"
                />
                <span className="text-xl">{stCfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-semibold text-sm ${isSelected ? stCfg.text : 'text-slate-800'}`}>
                    {station}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">{stCfg.desc}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? `border-current ${stCfg.text}` : 'border-slate-300'
                  }`}
                >
                  {isSelected && <div className={`w-2 h-2 rounded-full ${stCfg.text.replace('text-', 'bg-')}`} />}
                </div>
              </label>
            );
          })}
        </div> : <div className="px-6 pb-6 text-xs text-slate-500">Production routing is controlled by management. Cashiers can submit the selling price for approval.</div>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanged}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuManagerPage() {
  const { data: session } = useSession();
  const propertyId = (session?.user as any)?.propertyId as string | undefined;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modals
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', categoryId: '', price: '', taxRate: '0', inventoryMode: 'NON_STOCK', productionStation: 'NONE' });

  // Error / success toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isCashier = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(
    String((session?.user as any)?.role || '').toUpperCase()
  );

  const handleCreateMenuRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingMenu(true);
    try {
      const response = await fetch('/api/v1/pos/products/menu-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMenu, price: Number(newMenu.price), taxRate: Number(newMenu.taxRate) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit menu request');
      setShowCreateMenu(false);
      setNewMenu({ name: '', categoryId: '', price: '', taxRate: '0', inventoryMode: 'NON_STOCK', productionStation: 'NONE' });
      showToast('Menu request sent for Accountant review');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to submit menu request', 'error');
    } finally {
      setCreatingMenu(false);
    }
  };

  // Fetch data
  const loadData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`/api/v1/pos/categories?propertyId=${propertyId}`),
        fetch(`/api/v1/pos/products?propertyId=${propertyId}`),
      ]);
      const [catJson, prodJson] = await Promise.all([catRes.json(), prodRes.json()]);
      if (catJson.data) setCategories(catJson.data);
      if (prodJson.data) setProducts(prodJson.data);
    } catch (err) {
      console.error('Failed to load menu data', err);
      showToast('Failed to load menu data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Category map for resolving names
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
    const matchesSearch = search
      ? p.name.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesCat && matchesSearch;
  });

  // Resolve effective station
  const resolveStation = (product: Product): { station: ProductionStation; isOverride: boolean } => {
    if (product.productionStation) {
      return { station: product.productionStation, isOverride: true };
    }
    const cat = categoryMap[product.categoryId];
    return { station: cat?.productionStation ?? 'NONE', isOverride: false };
  };

  // PATCH category
  const handleSaveCategoryStation = async (station: ProductionStation) => {
    if (!editingCategory) return;
    const res = await fetch(`/api/v1/pos/categories/${editingCategory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productionStation: station }),
    });
    if (!res.ok) throw new Error('Failed to update category');
    const json = await res.json();
    setCategories((prev) =>
      prev.map((c) => (c.id === editingCategory.id ? { ...c, ...json.data } : c))
    );
    showToast(`Updated station for "${editingCategory.name}"`);
  };

  // PATCH product
  const handleSaveProductStation = async (station: ProductionStation | null, price: number) => {
    if (!editingProduct) return;
    const role = String((session?.user as any)?.role || '').toUpperCase();
    if (['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(role) && price !== Number(editingProduct.price)) {
      const request = await fetch(`/api/v1/pos/products/${editingProduct.id}/price-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, reason: `Selling price change requested for ${editingProduct.name}` }),
      });
      const requestBody = await request.json();
      if (!request.ok) throw new Error(requestBody.error || 'Failed to submit price request');
      showToast(`Price request sent for Accountant review`);
      return;
    }
    const res = await fetch(`/api/v1/pos/products/${editingProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productionStation: station, ...(price !== Number(editingProduct.price) ? { price } : {}) }),
    });
    if (!res.ok) throw new Error('Failed to update product');
    const json = await res.json();
    setProducts((prev) =>
      prev.map((p) => (p.id === editingProduct.id ? { ...p, ...json.data } : p))
    );
    showToast(`Updated product settings for "${editingProduct.name}"`);
  };

  // Station breakdown counts
  const stationCounts = (Object.keys(STATION_CONFIG) as ProductionStation[]).reduce(
    (acc, s) => {
      acc[s] = categories.filter((c) => c.productionStation === s).length;
      return acc;
    },
    {} as Record<ProductionStation, number>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Page header */}
      <div className="border-b bg-white px-6 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Menu Manager</h1>
              <p className="text-sm text-slate-500">
                Manage categories, products, and production station routing
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCashier && <button onClick={() => setShowCreateMenu(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">New menu request</button>}
              <Link href="/cashier/price-approvals" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{isCashier ? 'My requests' : 'Price approvals'}</Link>
            </div>
          </div>
          {/* Station overview pills */}
          <div className="hidden lg:flex items-center gap-2">
            {(Object.keys(STATION_CONFIG) as ProductionStation[]).map((s) => {
              const cfg = STATION_CONFIG[s];
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                >
                  {cfg.icon} {stationCounts[s]} {s}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Loading menu data…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ─── Left Panel: Categories ─── */}
          <aside className="w-64 shrink-0 border-r bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Categories
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* "All" option */}
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full text-left flex items-center justify-between px-4 py-3 border-b transition-colors ${
                  selectedCategoryId === null
                    ? 'bg-indigo-50 border-l-[3px] border-l-indigo-600'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ListFilter className={`w-4 h-4 shrink-0 ${selectedCategoryId === null ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium truncate ${selectedCategoryId === null ? 'text-indigo-700' : 'text-slate-700'}`}>
                    All Categories
                  </span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{products.length}</span>
              </button>

              {categories.map((cat) => {
                const cfg = STATION_CONFIG[cat.productionStation];
                const isSelected = selectedCategoryId === cat.id;
                const catProductCount = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className={`border-b border-l-[3px] transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-l-indigo-600'
                        : 'hover:bg-slate-50 border-l-transparent'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                      className="w-full text-left flex items-start justify-between px-4 py-3 gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                            {cat.name}
                          </span>
                          {isSelected && <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        </div>
                        <StationBadge station={cat.productionStation} small />
                      </div>
                      <span className="text-xs text-slate-400 shrink-0 mt-0.5">{catProductCount}</span>
                    </button>
                    {/* Edit station button */}
                    {!isCashier && <div className="px-4 pb-3 -mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(cat);
                        }}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${cfg.bg} ${cfg.text} hover:opacity-80`}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        Edit Station
                      </button>
                    </div>}
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  No categories found
                </div>
              )}
            </div>
          </aside>

          {/* ─── Right Panel: Products ─── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="shrink-0 px-6 py-3 border-b bg-white flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
              <span className="text-sm text-slate-500">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'product' : 'products'}
                {selectedCategoryId && categories.find((c) => c.id === selectedCategoryId)
                  ? ` in "${categories.find((c) => c.id === selectedCategoryId)!.name}"`
                  : ''}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Utensils className="w-12 h-12 text-slate-200 mb-3" />
                  <h3 className="text-base font-medium text-slate-600">No products found</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {search ? 'Try a different search term.' : 'Select a category or add products.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b z-10">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Product
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Category
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Price
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Tax
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Station
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Status
                      </th>
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredProducts.map((product) => {
                      const cat = categoryMap[product.categoryId];
                      const { station, isOverride } = resolveStation(product);
                      const price =
                        typeof product.price === 'string'
                          ? parseFloat(product.price)
                          : product.price;
                      const taxRate =
                        typeof product.taxRate === 'string'
                          ? parseFloat(product.taxRate)
                          : product.taxRate;

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-indigo-50/30 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{product.name}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">
                            {cat?.name ?? '—'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {formatCurrency(price)}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {taxRate > 0 ? `${taxRate}%` : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <StationBadge
                                station={station}
                                inherited={!isOverride}
                                override={isOverride}
                              />
                              {!isOverride && (
                                <span className="text-[10px] text-slate-400 ml-0.5">(cat.)</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                product.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {product.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Pencil className="w-3 h-3" />
                              Station
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Modals */}
      {editingCategory && (
        <CategoryEditModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleSaveCategoryStation}
        />
      )}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categoryStation={categoryMap[editingProduct.categoryId]?.productionStation ?? 'KITCHEN'}
          canEditStation={!isCashier}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveProductStation}
        />
      )}
      {showCreateMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreateMenuRequest} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Request new menu item</h2><p className="text-sm text-slate-500">Accountant reviews the details; Manager publishes it to POS.</p></div><button type="button" onClick={() => setShowCreateMenu(false)}><X className="h-5 w-5 text-slate-500" /></button></div>
            <input required placeholder="Menu item name" value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} className="w-full rounded-lg border p-2.5 text-sm" />
            <select required value={newMenu.categoryId} onChange={(e) => setNewMenu({ ...newMenu, categoryId: e.target.value })} className="w-full rounded-lg border p-2.5 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm text-slate-600">Selling price<input required min="0" step="0.01" type="number" value={newMenu.price} onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label><label className="text-sm text-slate-600">Tax rate %<input min="0" max="100" step="0.01" type="number" value={newMenu.taxRate} onChange={(e) => setNewMenu({ ...newMenu, taxRate: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm text-slate-600">Stock handling<select value={newMenu.inventoryMode} onChange={(e) => setNewMenu({ ...newMenu, inventoryMode: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="NON_STOCK">Non-stock / service</option><option value="STOCK">Stock-controlled</option></select></label><label className="text-sm text-slate-600">Production station<select value={newMenu.productionStation} onChange={(e) => setNewMenu({ ...newMenu, productionStation: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm">{(Object.keys(STATION_CONFIG) as ProductionStation[]).map((station) => <option key={station} value={station}>{station}</option>)}</select></label></div>
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setShowCreateMenu(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={creatingMenu} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creatingMenu && <Loader2 className="h-4 w-4 animate-spin" />}Submit request</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

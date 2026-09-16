'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, Loader2, Tags, ShieldCheck, Check, X, AlertCircle, BarChart3, CircleDollarSign, Layers3, PackageCheck, Store, TrendingUp, Utensils } from 'lucide-react';

type AnyRecord = Record<string, any>;
const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
const categoryKey = (name: unknown) => String(name || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

function groupProducts(rows: AnyRecord[]) {
  const groups = new Map<string, AnyRecord>();
  for (const row of rows) {
    const key = row.itemCode || `${String(row.name).trim().toLowerCase()}|${Number(row.price)}|${Number(row.taxRate || 0)}`;
    const location = { id: row.id, categoryId: row.categoryId, outletId: row.category?.outlet?.id, category: row.category?.name || 'Uncategorized', outlet: row.category?.outlet?.name || 'Outlet' };
    const targets = (row.modifiers || []).map((modifier: AnyRecord) => ({ ...modifier, productId: row.id }));
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...row, locations: [location], modifierTargets: targets, modifiers: row.modifiers || [] });
      continue;
    }
    existing.locations.push(location);
    existing.isActive = existing.isActive || row.isActive;
    existing.modifierTargets.push(...targets);
    const known = new Set(existing.modifiers.map((modifier: AnyRecord) => `${modifier.name}|${Number(modifier.price)}`));
    for (const modifier of row.modifiers || []) if (!known.has(`${modifier.name}|${Number(modifier.price)}`)) existing.modifiers.push(modifier);
  }
  return [...groups.values()];
}

export function FnbMenuClient() {
  const { propertyId } = useProperty();
  const [products, setProducts] = useState<AnyRecord[]>([]);
  const [categories, setCategories] = useState<AnyRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<AnyRecord[]>([]);
  const [outlets, setOutlets] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [inventoryFilter, setInventoryFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [dialog, setDialog] = useState<'item' | 'price' | 'category' | 'modifier' | null>(null);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [priceProduct, setPriceProduct] = useState<AnyRecord | null>(null);
  const [modifierProduct, setModifierProduct] = useState<AnyRecord | null>(null);
  const [modifierEditing, setModifierEditing] = useState<AnyRecord | null>(null);
  const [item, setItem] = useState({ name: '', price: '', taxRate: '0', categoryId: '', inventoryMode: 'NON_STOCK', stockItemId: '' });
  const [newPrice, setNewPrice] = useState('');
  const [modifier, setModifier] = useState({ name: '', price: '0', quantity: '1', unitOfMeasure: '' });
  const [categoryDraft, setCategoryDraft] = useState({ name: '', outletId: '', productionStation: 'KITCHEN' });
  const [categoryAllOutlets, setCategoryAllOutlets] = useState(true);
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true); setError('');
    try {
      const [productsResponse, categoriesResponse, outletsResponse, inventoryResponse] = await Promise.all([
        fetch(`/api/v1/pos/products?all=true&propertyId=${encodeURIComponent(propertyId)}`),
        fetch(`/api/v1/pos/categories?all=true&propertyId=${encodeURIComponent(propertyId)}`),
        fetch(`/api/v1/pos/outlets?propertyId=${encodeURIComponent(propertyId)}`),
        fetch(`/api/v1/pos/inventory-items?propertyId=${encodeURIComponent(propertyId)}`),
      ]);
      if (!productsResponse.ok || !categoriesResponse.ok || !outletsResponse.ok || !inventoryResponse.ok) throw new Error('Unable to load menu configuration');
      const [productsBody, categoriesBody, outletsBody, inventoryBody] = await Promise.all([productsResponse.json(), categoriesResponse.json(), outletsResponse.json(), inventoryResponse.json()]);
      setProducts(groupProducts(productsBody.data || []));
      setCategories(categoriesBody.data || []);
      setOutlets((outletsBody.data || []).filter((outlet: AnyRecord) => outlet.propertyId === propertyId));
      setInventoryItems(inventoryBody.data || []);
    } catch (err: any) { setError(err.message || 'Could not load menu items'); }
    finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [product.itemCode, product.name, ...(product.locations || []).map((location: AnyRecord) => `${location.category} ${location.outlet}`)].some((value) => String(value || '').toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'ALL' || (product.locations || []).some((location: AnyRecord) => categoryKey(location.category) === categoryFilter);
    const matchesAvailability = availabilityFilter === 'ALL' || (availabilityFilter === 'ACTIVE' ? product.isActive : !product.isActive);
    const matchesInventory = inventoryFilter === 'ALL' || product.inventoryMode === inventoryFilter;
    return matchesSearch && matchesCategory && matchesAvailability && matchesInventory;
  }), [products, search, categoryFilter, availabilityFilter, inventoryFilter]);

  const categoryGroups = useMemo(() => {
    const grouped = new Map<string, AnyRecord>();
    for (const category of categories) {
      const key = categoryKey(category.name);
      const current = grouped.get(key);
      if (current) {
        current.categoryIds.push(category.id);
        current.outletNames.push(category.outlet?.name || 'Outlet');
        current.isActive = current.isActive || category.isActive;
      } else {
        grouped.set(key, { ...category, categoryIds: [category.id], outletNames: [category.outlet?.name || 'Outlet'] });
      }
    }
    return [...grouped.values()];
  }, [categories]);

  const categoryOptions = useMemo(() => categoryGroups.filter((category) => category.isActive), [categoryGroups]);

  const menuInsights = useMemo(() => {
    const activeItems = products.filter((product) => product.isActive).length;
    const inactiveItems = products.length - activeItems;
    const outOfStock = products.filter((product) => product.stockStatus === 'OUT_OF_STOCK').length;
    const stockControlled = products.filter((product) => product.inventoryMode === 'STOCK' || product.inventoryMode === 'PREPARED_RECIPE').length;
    const modifierCount = products.reduce((total, product) => total + (product.modifiers?.length || 0), 0);
    const categoryMix = categoryGroups.map((category) => ({
      name: category.name,
      items: products.filter((product) => (product.locations || []).some((location: AnyRecord) => categoryKey(location.category) === categoryKey(category.name))).length,
    })).sort((a, b) => b.items - a.items).slice(0, 5);
    return { activeItems, inactiveItems, outOfStock, stockControlled, modifierCount, categoryMix };
  }, [products, categoryGroups]);

  const request = async (url: string, method: string, body: AnyRecord) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || 'Request failed');
    return json;
  };
  const productIds = (product: AnyRecord) => (product.locations || [{ id: product.id }]).map((location: AnyRecord) => location.id);

  const openAdd = () => { setEditing(null); setItem({ name: '', price: '', taxRate: '0', categoryId: categoryOptions[0]?.id || '', inventoryMode: 'NON_STOCK', stockItemId: '' }); setDialog('item'); };
  const openEdit = (product: AnyRecord) => { const productCategory = categories.find((category) => category.id === product.categoryId); const groupedCategory = productCategory ? categoryOptions.find((category) => categoryKey(category.name) === categoryKey(productCategory.name)) : null; const linkedStock = (product.stockItems || []).find((stock: AnyRecord) => stock.warehouse?.posOutletId == null) || product.stockItems?.[0]; setEditing(product); setItem({ name: product.name, price: String(product.price), taxRate: String(product.taxRate || 0), categoryId: groupedCategory?.id || product.categoryId, inventoryMode: product.inventoryMode, stockItemId: linkedStock?.id || '' }); setDialog('item'); };
  const openModifiers = (product: AnyRecord) => { setModifierProduct(product); setModifierEditing(null); setModifier({ name: '', price: '0', quantity: '1', unitOfMeasure: '' }); setDialog('modifier'); };

  const saveItem = async () => {
    setSaving(true); setMessage('');
    try {
      if (!item.name.trim() || !item.categoryId) throw new Error('Name and category are required');
      if (!editing && item.inventoryMode === 'STOCK' && !item.stockItemId) throw new Error('Select a main-warehouse inventory item for stock-controlled products');
      if (editing) {
        const selectedCategory = categoryOptions.find((category) => category.id === item.categoryId);
        for (const location of editing.locations || [{ id: editing.id, outletId: undefined }]) {
          const targetCategory = selectedCategory?.categoryIds
            .map((categoryId: string) => categories.find((category) => category.id === categoryId))
            .find((category: AnyRecord | undefined) => !location.outletId || category?.outletId === location.outletId);
          await request(`/api/v1/pos/products/${location.id}`, 'PATCH', { name: item.name, categoryId: targetCategory?.id || item.categoryId, taxRate: Number(item.taxRate), inventoryMode: item.inventoryMode });
        }
        if (Number(item.price) !== Number(editing.price)) await request(`/api/v1/pos/products/${editing.id}/price-request`, 'POST', { price: Number(item.price), reason: 'Price change submitted from menu management' });
        setMessage(Number(item.price) !== Number(editing.price) ? 'Details saved; price is awaiting approval.' : 'Menu item updated.');
      } else {
        const selectedCategory = categories.find((category) => category.id === item.categoryId);
        const categoryIds = selectedCategory?.categoryIds || [item.categoryId];
        await request('/api/v1/pos/products/menu-request', 'POST', { propertyId, name: item.name, price: Number(item.price), taxRate: Number(item.taxRate), categoryId: item.categoryId, categoryIds, inventoryMode: item.inventoryMode, stockItemId: item.stockItemId || undefined });
        setMessage('New item submitted for approval.');
      }
      setDialog(null); await load();
    } catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const changePrice = async () => {
    if (!priceProduct) return;
    setSaving(true);
    try { const ids = productIds(priceProduct); await request(`/api/v1/pos/products/${ids[0]}/price-request`, 'POST', { productIds: ids, price: Number(newPrice), reason: 'Grouped outlet price change' }); setDialog(null); setMessage('One price request submitted for all outlet copies: General Cashier → Accountant → General Manager.'); await load(); }
    catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const saveModifier = async () => {
    if (!modifierProduct) return;
    setSaving(true);
    try {
      const targets = modifierEditing ? (modifierProduct.modifierTargets || []).filter((target: AnyRecord) => target.name === modifierEditing.name) : productIds(modifierProduct).map((productId: string) => ({ productId, id: undefined }));
      for (const target of targets) await request('/api/v1/pos/modifier-requests', 'POST', { productId: target.productId, modifierId: target.id, name: modifier.name, price: Number(modifier.price), quantity: Number(modifier.quantity), unitOfMeasure: modifier.unitOfMeasure || undefined, reason: 'Menu management modifier request' });
      setDialog(null); setMessage('Modifier request submitted for approval.'); await load();
    } catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (product: AnyRecord) => { try { for (const id of productIds(product)) await request(`/api/v1/pos/products/${id}`, 'PATCH', { isActive: !product.isActive }); setMessage(product.isActive ? 'Item 86’d across outlets.' : 'Item made available across outlets.'); await load(); } catch (err: any) { setMessage(err.message); } };
  const saveCategory = async () => { setSaving(true); try { const result = await request('/api/v1/pos/categories', 'POST', { propertyId, ...categoryDraft, allOutlets: categoryAllOutlets }); const count = result.data?.createdCount ?? 0; setMessage(categoryAllOutlets ? `Category created for ${count} active outlet${count === 1 ? '' : 's'}.` : 'Category created.'); await load(); } catch (err: any) { setMessage(err.message); } finally { setSaving(false); } };
  const updateCategory = async (category: AnyRecord) => { try { const name = categoryEdits[category.id] ?? category.name; await Promise.all(category.categoryIds.map((categoryId: string) => request(`/api/v1/pos/categories/${categoryId}`, 'PATCH', { propertyId, name }))); setMessage(`Category updated across ${category.categoryIds.length} outlet${category.categoryIds.length === 1 ? '' : 's'}.`); await load(); } catch (err: any) { setMessage(err.message); } };
  const toggleCategory = async (category: AnyRecord) => { try { await Promise.all(category.categoryIds.map((categoryId: string) => request(`/api/v1/pos/categories/${categoryId}`, 'PATCH', { propertyId, isActive: !category.isActive }))); setMessage(category.isActive ? 'Category deactivated across outlets.' : 'Category activated across outlets.'); await load(); } catch (err: any) { setMessage(err.message); } };

  return (
    <div className="min-h-screen bg-[#fbf8f6] text-[#24130d] font-sans">
      <div className="mx-auto max-w-[1600px]">
        
        <div className="border-b border-[#3d2318] bg-[#24130d] px-4 py-7 text-white sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300"><Utensils className="h-4 w-4" /> F&B menu control</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Menu command centre</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">Control the menu catalogue, pricing workflow, availability, inventory linkage, and outlet consistency from one manager workspace.</p></div>
            <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setDialog('category')} className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white shadow-sm transition-all duration-200">
              <Tags className="mr-2 h-4 w-4" />
              Categories
            </Button>
            <Button variant="outline" asChild className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white shadow-sm transition-all duration-200">
              <a href="/fnb/requests">
                <ShieldCheck className="mr-2 h-4 w-4 text-orange-300" />
                My Requests
              </a>
            </Button>
            <Button onClick={openAdd} className="bg-orange-500 text-white hover:bg-orange-600 shadow-sm transition-all duration-200">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Menu items', value: products.length, detail: `${menuInsights.activeItems} available across outlets`, icon: Layers3, tone: 'bg-orange-50 text-orange-600' },
              { label: 'Categories', value: categoryGroups.length, detail: `${categoryOptions.length} active categories`, icon: BarChart3, tone: 'bg-[#f7eee9] text-[#7c2d12]' },
              { label: 'Stock linked', value: menuInsights.stockControlled, detail: `${menuInsights.outOfStock} currently out of stock`, icon: PackageCheck, tone: menuInsights.outOfStock ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600' },
              { label: 'Outlet coverage', value: outlets.length, detail: `${menuInsights.modifierCount} modifiers configured`, icon: Store, tone: 'bg-amber-50 text-amber-600' },
            ].map((metric) => <div key={metric.label} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">{metric.label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-[#24130d]">{metric.value}</p><p className="mt-1 text-xs text-[#927b70]">{metric.detail}</p></div><span className={`rounded-xl p-3 ${metric.tone}`}><metric.icon className="h-5 w-5" /></span></div></div>)}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold text-[#24130d]">Menu health</h2><p className="mt-1 text-xs text-[#927b70]">Signals that affect service readiness and revenue capture</p></div><TrendingUp className="h-5 w-5 text-orange-500" /></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#fff7ed] p-4"><p className="text-xs font-semibold text-orange-700">Available</p><p className="mt-2 text-xl font-bold text-orange-950">{menuInsights.activeItems}</p><p className="mt-1 text-xs text-orange-700/80">Items live for ordering</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-semibold text-red-700">Needs attention</p><p className="mt-2 text-xl font-bold text-red-950">{menuInsights.outOfStock + menuInsights.inactiveItems}</p><p className="mt-1 text-xs text-red-700/80">Out of stock or 86’d</p></div><div className="rounded-xl bg-[#f7eee9] p-4"><p className="text-xs font-semibold text-[#7c2d12]">Price workflow</p><p className="mt-2 text-xl font-bold text-[#3d2318]">Approval-led</p><p className="mt-1 text-xs text-[#7c2d12]/80">Changes remain controlled</p></div></div></section>
            <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold text-[#24130d]">Category coverage</h2><p className="mt-1 text-xs text-[#927b70]">Items grouped by menu class</p></div><CircleDollarSign className="h-5 w-5 text-orange-500" /></div><div className="space-y-3">{menuInsights.categoryMix.length ? menuInsights.categoryMix.map((category) => { const percentage = products.length ? Math.round((category.items / products.length) * 100) : 0; return <div key={category.name}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-[#4f392f]">{category.name}</span><span className="text-[#927b70]">{category.items} · {percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f4ebe6]"><div className="h-full rounded-full bg-orange-500" style={{ width: `${percentage}%` }} /></div></div>; }) : <p className="py-5 text-center text-sm text-[#927b70]">No categories configured yet.</p>}</div></section>
          </div>

        {/* Notifications */}
        {(error || message) && (
          <div className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${error ? 'border-red-100 bg-red-50 text-red-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>
            <AlertCircle className={`h-5 w-5 ${error ? 'text-red-500' : 'text-emerald-500'}`} />
            <p className="text-sm font-medium">{error || message}</p>
          </div>
        )}

        {/* Control Surface */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200">
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search item, category, or outlet..." 
                className="pl-9 h-10 border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-none transition-all duration-200" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select 
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:1.25em_1.25em] pr-10" 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {categoryOptions.map((category) => <option key={category.id} value={categoryKey(category.name)}>{category.name} ({category.outletNames.length} outlet{category.outletNames.length === 1 ? '' : 's'})</option>)}
              </select>

              <select 
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:1.25em_1.25em] pr-10" 
                value={availabilityFilter} 
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Available</option>
                <option value="INACTIVE">86'd</option>
              </select>

              <Button 
                variant="ghost" 
                className={`h-10 px-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 ${showFilters ? 'bg-slate-100' : ''}`}
                onClick={() => setShowFilters((value) => !value)}
              >
                <Filter className="mr-2 h-4 w-4" />
                More
              </Button>

              {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600 ml-2" />}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-4 rounded-b-2xl animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="flex items-center gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Inventory Mode</label>
                  <select 
                    className="h-9 w-48 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:1.2em_1.2em] pr-8" 
                    value={inventoryFilter} 
                    onChange={(e) => setInventoryFilter(e.target.value)}
                  >
                    <option value="ALL">All Modes</option>
                    <option value="NON_STOCK">Non-stock</option>
                    <option value="STOCK">Stock</option>
                    <option value="PREPARED_RECIPE">Prepared recipe</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">Item & Description</th>
                  <th className="px-6 py-4">Locations</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 rounded-tr-2xl"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`group transition-colors duration-150 hover:bg-slate-50/80 ${!product.isActive ? 'opacity-75 bg-slate-50/50' : ''}`}
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col">
                        <span className={`font-medium ${!product.isActive ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>
                          {product.name}
                        </span>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {product.itemCode || product.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span>&bull;</span>
                          <span>{product.inventoryMode.replace('_', ' ')}</span>
                          {product.modifiers?.length > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 text-emerald-600">
                                <Plus className="h-3 w-3" />
                                {product.modifiers.length} mod{product.modifiers.length === 1 ? '' : 's'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-medium">
                          {product.locations?.length || 1} outlet{product.locations?.length === 1 ? '' : 's'}
                        </span>
                        <span className="mt-1 text-xs text-slate-500 line-clamp-2 max-w-xs leading-relaxed">
                          {(product.locations || []).map((loc: AnyRecord) => `${loc.category} (${loc.outlet})`).join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {!product.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/60 shadow-sm">
                          86'd
                        </span>
                      ) : product.stockStatus === 'OUT_OF_STOCK' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 shadow-sm">
                          Out of stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <span className="font-medium text-slate-900 tracking-tight">
                        {money(Number(product.price))}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="relative inline-block text-left">
                        <select 
                          aria-label={`Actions for ${product.name}`} 
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm outline-none hover:bg-slate-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%2219%22%20cy%3D%2212%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%225%22%20cy%3D%2212%22%20r%3D%221%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-center pr-8 w-10 opacity-0 group-hover:opacity-100 focus:opacity-100" 
                          value="" 
                          onChange={(e) => { 
                            const action = e.target.value; 
                            if (action === 'edit') openEdit(product); 
                            if (action === 'price') { setPriceProduct(product); setNewPrice(String(product.price)); setDialog('price'); } 
                            if (action === 'modifiers') openModifiers(product); 
                            if (action === 'toggle') void toggleActive(product); 
                          }}
                        >
                          <option value="" disabled className="hidden"></option>
                          <option value="edit">Edit Details</option>
                          <option value="price">Request Price Change</option>
                          <option value="modifiers">Manage Modifiers</option>
                          <option value="toggle">{product.isActive ? "86'd across outlets" : "Make available"}</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredProducts.length && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <Search className="h-8 w-8 mb-3 text-slate-300" />
                        <p className="text-base font-medium text-slate-700">No menu items found</p>
                        <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && !filteredProducts.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="h-8 w-8 mb-3 animate-spin text-emerald-500" />
                        <p className="text-sm">Loading menu items...</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dialogs / Modals */}
        {dialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
              aria-hidden="true" 
              onClick={() => setDialog(null)}
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-900">
                  {dialog === 'item' ? (editing ? 'Edit Menu Item' : 'Request New Menu Item') 
                    : dialog === 'price' ? 'Request Price Change' 
                    : dialog === 'modifier' ? `Modifiers: ${modifierProduct?.name}` 
                    : 'Category Management'}
                </h2>
                <button 
                  onClick={() => setDialog(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto">
                {dialog === 'item' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Item Name</label>
                      <Input 
                        placeholder="e.g. Avocado Toast" 
                        className="h-10 border-slate-200 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-sm"
                        value={item.name} 
                        onChange={(e) => setItem({ ...item, name: e.target.value })} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Selling Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                          <Input 
                            type="number" 
                            className="h-10 pl-7 border-slate-200 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                            value={item.price} 
                            onChange={(e) => setItem({ ...item, price: e.target.value })} 
                            disabled={!!editing} 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Tax Rate (%)</label>
                        <Input 
                          type="number" 
                          className="h-10 border-slate-200 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-sm"
                          value={item.taxRate} 
                          onChange={(e) => setItem({ ...item, taxRate: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Category Assignment</label>
                      <select 
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:1em_1em] pr-10"
                        value={item.categoryId} 
                        onChange={(e) => setItem({ ...item, categoryId: e.target.value })}
                      >
                        <option value="" disabled>Select category...</option>
                        {categoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>{category.name} ({category.outletNames.length} outlet{category.outletNames.length === 1 ? '' : 's'})</option>
                        ))}
                      </select>
                    </div>

                    {!editing && <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Inventory Control</label>
                        <select className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={item.inventoryMode} onChange={(e) => setItem({ ...item, inventoryMode: e.target.value, stockItemId: e.target.value === 'STOCK' ? item.stockItemId : '' })}>
                          <option value="NON_STOCK">Non-stock</option>
                          <option value="STOCK">Stock-controlled</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Main Warehouse Item</label>
                        <select className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={item.stockItemId} disabled={item.inventoryMode !== 'STOCK'} onChange={(e) => setItem({ ...item, stockItemId: e.target.value })}>
                          <option value="">Select inventory item...</option>
                          {inventoryItems.map((stock) => <option key={stock.id} value={stock.id}>{stock.name}{stock.sku ? ` · ${stock.sku}` : ''} · {stock.warehouse?.name || 'Main warehouse'}</option>)}
                        </select>
                      </div>
                    </div>}

                    <div className="pt-4 flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => setDialog(null)} className="text-slate-600">Cancel</Button>
                      <Button onClick={() => void saveItem()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editing ? 'Save Details' : 'Submit for Approval'}
                      </Button>
                    </div>
                  </div>
                )}

                {dialog === 'price' && (
                  <div className="space-y-5">
                    <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100">
                      <div className="flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-900">Approval Required</h4>
                          <p className="text-sm text-emerald-700 mt-1">This grouped item has <span className="font-semibold">{priceProduct?.locations?.length || 1}</span> outlet copies. Each price request requires General Cashier → Accountant → General Manager approval.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Proposed New Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₦</span>
                        <Input 
                          type="number" 
                          className="h-12 pl-8 text-lg font-medium border-slate-300 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-sm"
                          value={newPrice} 
                          onChange={(e) => setNewPrice(e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => setDialog(null)} className="text-slate-600">Cancel</Button>
                      <Button onClick={() => void changePrice()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                      </Button>
                    </div>
                  </div>
                )}

                {dialog === 'modifier' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Existing Modifiers</h3>
                      <div className="max-h-[30vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {(modifierProduct?.modifiers || []).map((entry: AnyRecord) => (
                          <div key={`${entry.name}-${entry.price}`} className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-emerald-200 transition-colors">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{entry.name}</span>
                              <span className="text-xs text-slate-500">{money(Number(entry.price))}</span>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => { 
                                setModifierEditing(entry); 
                                setModifier({ name: entry.name, price: String(entry.price), quantity: String(entry.quantity || 1), unitOfMeasure: entry.unitOfMeasure || '' }); 
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        ))}
                        {!(modifierProduct?.modifiers || []).length && (
                          <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                            <p className="text-sm text-slate-500">No modifiers configured.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                      <h3 className="text-sm font-medium text-slate-900">{modifierEditing ? 'Edit Modifier' : 'Add New Modifier'}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-xs font-medium text-slate-600">Modifier Name</label>
                          <Input 
                            className="h-9 bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            value={modifier.name} 
                            onChange={(e) => setModifier({ ...modifier, name: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-600">Additional Price (₦)</label>
                          <Input 
                            type="number" 
                            className="h-9 bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            value={modifier.price} 
                            onChange={(e) => setModifier({ ...modifier, price: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-600">Quantity Included</label>
                          <Input 
                            type="number" 
                            className="h-9 bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            value={modifier.quantity} 
                            onChange={(e) => setModifier({ ...modifier, quantity: e.target.value })} 
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-xs font-medium text-slate-600">Unit of Measure (Optional)</label>
                          <Input 
                            placeholder="e.g. shot, slice, extra"
                            className="h-9 bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            value={modifier.unitOfMeasure} 
                            onChange={(e) => setModifier({ ...modifier, unitOfMeasure: e.target.value })} 
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-[11px] text-slate-500 max-w-[200px] leading-tight">Price changes require accountant & GM approval.</p>
                        <Button 
                          size="sm"
                          onClick={() => void saveModifier()} 
                          disabled={saving}
                          className="bg-slate-900 text-white hover:bg-slate-800"
                        >
                          {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          {modifierEditing ? 'Update Modifier' : 'Add Modifier'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {dialog === 'category' && (
                  <div className="space-y-6">
                    {/* Create New Category */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                      <h3 className="text-sm font-medium text-slate-900">Create New Category</h3>
                      
                      <div className="space-y-3">
                        <Input 
                          placeholder="Category name (e.g. Starters, Beverages)" 
                          className="h-10 bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                          value={categoryDraft.name} 
                          onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} 
                        />
                        
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center mt-0.5">
                            <input 
                              type="checkbox" 
                              className="peer sr-only"
                              checked={categoryAllOutlets} 
                              onChange={(e) => setCategoryAllOutlets(e.target.checked)} 
                            />
                            <div className="h-4 w-4 rounded border border-slate-300 bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-colors"></div>
                            <Check className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Global Category</span>
                            <span className="text-xs text-slate-500">Create this category across all active outlets</span>
                          </div>
                        </label>
                        
                        {!categoryAllOutlets && (
                          <div className="pl-7 animate-in fade-in slide-in-from-top-1 duration-200">
                            <select 
                              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:1em_1em] pr-10"
                              value={categoryDraft.outletId} 
                              onChange={(e) => setCategoryDraft({ ...categoryDraft, outletId: e.target.value })}
                            >
                              <option value="" disabled>Select specific outlet</option>
                              {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                            </select>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <Button 
                            onClick={() => void saveCategory()} 
                            disabled={saving || (!categoryAllOutlets && !categoryDraft.outletId) || !categoryDraft.name.trim()}
                            className="w-full bg-slate-900 text-white hover:bg-slate-800"
                          >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {categoryAllOutlets ? 'Create Global Category' : 'Create Category'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Manage Existing */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">Manage Categories</h3>
                      <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {categoryGroups.map((category) => (
                          <div key={category.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                            <Input 
                              className="h-9 flex-1 bg-transparent border-transparent hover:border-slate-200 focus-visible:bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 px-2 transition-all font-medium text-sm"
                              value={categoryEdits[category.id] ?? category.name} 
                              onChange={(e) => setCategoryEdits({ ...categoryEdits, [category.id]: e.target.value })} 
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => void updateCategory(category)}
                              >
                                Save
                              </Button>
                              <div className="w-px h-4 bg-slate-200"></div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-8 px-2 text-xs font-medium ${category.isActive ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                onClick={() => void toggleCategory(category)}
                              >
                                {category.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </div>
                        ))}
                        {categoryGroups.length === 0 && (
                          <p className="text-sm text-slate-500 text-center py-4">No categories created yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

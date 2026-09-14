'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, Loader2, Tags, ShieldCheck, SlidersHorizontal } from 'lucide-react';

type AnyRecord = Record<string, any>;
const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

function groupProducts(rows: AnyRecord[]) {
  const groups = new Map<string, AnyRecord>();
  for (const row of rows) {
    const key = row.itemCode || `${String(row.name).trim().toLowerCase()}|${Number(row.price)}|${Number(row.taxRate || 0)}`;
    const location = { id: row.id, categoryId: row.categoryId, category: row.category?.name || 'Uncategorized', outlet: row.category?.outlet?.name || 'Outlet' };
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
  const [item, setItem] = useState({ name: '', price: '', taxRate: '0', categoryId: '', inventoryMode: 'NON_STOCK' });
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
      const [productsResponse, categoriesResponse, outletsResponse] = await Promise.all([
        fetch(`/api/v1/pos/products?all=true&propertyId=${encodeURIComponent(propertyId)}`),
        fetch(`/api/v1/pos/categories?all=true&propertyId=${encodeURIComponent(propertyId)}`),
        fetch(`/api/v1/pos/outlets?propertyId=${encodeURIComponent(propertyId)}`),
      ]);
      if (!productsResponse.ok || !categoriesResponse.ok || !outletsResponse.ok) throw new Error('Unable to load menu configuration');
      const [productsBody, categoriesBody, outletsBody] = await Promise.all([productsResponse.json(), categoriesResponse.json(), outletsResponse.json()]);
      setProducts(groupProducts(productsBody.data || []));
      setCategories(categoriesBody.data || []);
      setOutlets((outletsBody.data || []).filter((outlet: AnyRecord) => outlet.propertyId === propertyId));
    } catch (err: any) { setError(err.message || 'Could not load menu items'); }
    finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [product.itemCode, product.name, ...(product.locations || []).map((location: AnyRecord) => `${location.category} ${location.outlet}`)].some((value) => String(value || '').toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'ALL' || (product.locations || []).some((location: AnyRecord) => location.categoryId === categoryFilter);
    const matchesAvailability = availabilityFilter === 'ALL' || (availabilityFilter === 'ACTIVE' ? product.isActive : !product.isActive);
    const matchesInventory = inventoryFilter === 'ALL' || product.inventoryMode === inventoryFilter;
    return matchesSearch && matchesCategory && matchesAvailability && matchesInventory;
  }), [products, search, categoryFilter, availabilityFilter, inventoryFilter]);

  const request = async (url: string, method: string, body: AnyRecord) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || 'Request failed');
    return json;
  };
  const productIds = (product: AnyRecord) => (product.locations || [{ id: product.id }]).map((location: AnyRecord) => location.id);

  const openAdd = () => { setEditing(null); setItem({ name: '', price: '', taxRate: '0', categoryId: categories.find((category) => category.isActive)?.id || '', inventoryMode: 'NON_STOCK' }); setDialog('item'); };
  const openEdit = (product: AnyRecord) => { setEditing(product); setItem({ name: product.name, price: String(product.price), taxRate: String(product.taxRate || 0), categoryId: product.categoryId, inventoryMode: product.inventoryMode }); setDialog('item'); };
  const openModifiers = (product: AnyRecord) => { setModifierProduct(product); setModifierEditing(null); setModifier({ name: '', price: '0', quantity: '1', unitOfMeasure: '' }); setDialog('modifier'); };

  const saveItem = async () => {
    setSaving(true); setMessage('');
    try {
      if (!item.name.trim() || !item.categoryId) throw new Error('Name and category are required');
      if (editing) {
        await request(`/api/v1/pos/products/${editing.id}`, 'PATCH', { name: item.name, categoryId: item.categoryId, taxRate: Number(item.taxRate), inventoryMode: item.inventoryMode });
        if (Number(item.price) !== Number(editing.price)) await request(`/api/v1/pos/products/${editing.id}/price-request`, 'POST', { price: Number(item.price), reason: 'Price change submitted from menu management' });
        setMessage(Number(item.price) !== Number(editing.price) ? 'Details saved; price is awaiting approval.' : 'Menu item updated.');
      } else {
        const selectedCategory = categories.find((category) => category.id === item.categoryId);
        const categoryIds = selectedCategory ? categories.filter((category) => category.isActive && category.name.trim().toLowerCase() === selectedCategory.name.trim().toLowerCase()).map((category) => category.id) : [item.categoryId];
        await request('/api/v1/pos/products/menu-request', 'POST', { propertyId, name: item.name, price: Number(item.price), taxRate: Number(item.taxRate), categoryId: item.categoryId, categoryIds, inventoryMode: item.inventoryMode });
        setMessage('New item submitted for approval.');
      }
      setDialog(null); await load();
    } catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const changePrice = async () => {
    if (!priceProduct) return;
    setSaving(true);
    try { for (const id of productIds(priceProduct)) await request(`/api/v1/pos/products/${id}/price-request`, 'POST', { price: Number(newPrice), reason: 'Grouped outlet price change' }); setDialog(null); setMessage('Price request submitted for all outlet copies: General Cashier → Accountant → General Manager.'); await load(); }
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
  const updateCategory = async (category: AnyRecord) => { try { await request(`/api/v1/pos/categories/${category.id}`, 'PATCH', { propertyId, name: categoryEdits[category.id] ?? category.name }); setMessage('Category updated.'); await load(); } catch (err: any) { setMessage(err.message); } };
  const toggleCategory = async (category: AnyRecord) => { try { await request(`/api/v1/pos/categories/${category.id}`, 'PATCH', { propertyId, isActive: !category.isActive }); setMessage(category.isActive ? 'Category deactivated.' : 'Category activated.'); await load(); } catch (err: any) { setMessage(err.message); } };

  return <div className="space-y-6 p-6">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-bold tracking-tight">Menu Management</h1><p className="mt-1 text-muted-foreground">One grouped menu item per property, with outlet locations and approved modifier management.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog('category')}><Tags className="mr-2 h-4 w-4" />Categories</Button><Button variant="outline" asChild><a href="/admin/pos/price-approvals"><ShieldCheck className="mr-2 h-4 w-4" />Approvals</a></Button><Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Item</Button></div></div>
    {(error || message) && <div className={`rounded-md border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
    <div className="rounded-lg border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search item, category, or outlet..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button variant="outline" onClick={() => setShowFilters((value) => !value)}><Filter className="mr-2 h-4 w-4" />Filters</Button>{loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>{showFilters && <div className="mt-3 grid gap-2 sm:grid-cols-3"><select className="h-9 rounded-md border bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}><option value="ALL">All availability</option><option value="ACTIVE">Available</option><option value="INACTIVE">86’d</option></select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)}><option value="ALL">All inventory modes</option><option value="NON_STOCK">Non-stock</option><option value="STOCK">Stock</option><option value="PREPARED_RECIPE">Prepared recipe</option></select></div>}</div>
    <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-left">Locations</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Availability</th><th className="p-3 text-right">Price</th><th className="p-3" /></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id} className={`border-b last:border-0 ${!product.isActive ? 'opacity-60' : ''}`}><td className="p-3"><div className="font-semibold">{product.name}</div><div className="text-xs text-muted-foreground">{product.itemCode || product.id.slice(0, 8).toUpperCase()} · {product.modifiers?.length || 0} modifier{product.modifiers?.length === 1 ? '' : 's'}</div></td><td className="p-3"><div className="font-medium">{product.locations?.length || 1} outlet location{product.locations?.length === 1 ? '' : 's'}</div><div className="max-w-xs text-xs text-muted-foreground">{(product.locations || []).map((location: AnyRecord) => `${location.outlet} / ${location.category}`).join(' · ')}</div></td><td className="p-3">{product.inventoryMode}</td><td className="p-3">{!product.isActive ? <Badge variant="destructive">86’d</Badge> : product.stockStatus === 'OUT_OF_STOCK' ? <Badge variant="destructive">Out of stock</Badge> : <Badge>Available</Badge>}</td><td className="p-3 text-right font-medium">{money(Number(product.price))}</td><td className="p-3 text-right"><select aria-label={`Actions for ${product.name}`} className="h-8 rounded-md border bg-background px-2 text-xs" value="" onChange={(e) => { const action = e.target.value; if (action === 'edit') openEdit(product); if (action === 'price') { setPriceProduct(product); setNewPrice(String(product.price)); setDialog('price'); } if (action === 'modifiers') openModifiers(product); if (action === 'toggle') void toggleActive(product); }}><option value=""><MoreHorizontal className="h-4 w-4" /></option><option value="edit">Edit details</option><option value="price">Request item price change</option><option value="modifiers">Manage modifiers</option><option value="toggle">{product.isActive ? '86’d across outlets' : 'Make available'}</option></select></td></tr>)}{!filteredProducts.length && !loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No menu items found.</td></tr>}</tbody></table></div>
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-xl space-y-4 rounded-xl bg-background p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{dialog === 'item' ? (editing ? 'Edit menu item' : 'Request new menu item') : dialog === 'price' ? 'Request price change' : dialog === 'modifier' ? `Modifiers · ${modifierProduct?.name}` : 'Category management'}</h2><Button variant="ghost" onClick={() => setDialog(null)}>×</Button></div>{dialog === 'item' && <div className="grid gap-3"><Input placeholder="Item name" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /><Input type="number" placeholder="Selling price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} disabled={!!editing} /><select className="h-10 rounded-md border bg-background px-3" value={item.categoryId} onChange={(e) => setItem({ ...item, categoryId: e.target.value })}><option value="">Select category</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name} · {category.outlet?.name || 'Outlet'}</option>)}</select><Input type="number" placeholder="Tax rate %" value={item.taxRate} onChange={(e) => setItem({ ...item, taxRate: e.target.value })} /><Button onClick={() => void saveItem()} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save details' : 'Submit for approval'}</Button></div>}{dialog === 'price' && <div className="grid gap-3"><p className="text-sm text-muted-foreground">This grouped item has {priceProduct?.locations?.length || 1} outlet copies. Each price request requires General Cashier → Accountant → General Manager approval.</p><Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /><Button onClick={() => void changePrice()} disabled={saving}>{saving ? 'Submitting...' : 'Submit price requests'}</Button></div>}{dialog === 'modifier' && <div className="space-y-4"><div className="max-h-48 space-y-2 overflow-y-auto">{(modifierProduct?.modifiers || []).map((entry: AnyRecord) => <div key={`${entry.name}-${entry.price}`} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{entry.name} · {money(Number(entry.price))}</span><Button size="sm" variant="outline" onClick={() => { setModifierEditing(entry); setModifier({ name: entry.name, price: String(entry.price), quantity: String(entry.quantity || 1), unitOfMeasure: entry.unitOfMeasure || '' }); }}>Edit</Button></div>)}{!(modifierProduct?.modifiers || []).length && <p className="text-sm text-muted-foreground">No modifiers yet.</p>}</div><div className="grid gap-2 rounded-md border p-3"><Input placeholder="Modifier name" value={modifier.name} onChange={(e) => setModifier({ ...modifier, name: e.target.value })} /><Input type="number" placeholder="Modifier price" value={modifier.price} onChange={(e) => setModifier({ ...modifier, price: e.target.value })} /><Input type="number" placeholder="Quantity" value={modifier.quantity} onChange={(e) => setModifier({ ...modifier, quantity: e.target.value })} /><Input placeholder="Unit of measure (optional)" value={modifier.unitOfMeasure} onChange={(e) => setModifier({ ...modifier, unitOfMeasure: e.target.value })} /><Button onClick={() => void saveModifier()} disabled={saving}>{saving ? 'Submitting...' : modifierEditing ? 'Submit modifier edit' : 'Submit new modifier'}</Button><p className="text-xs text-muted-foreground">Modifier changes and modifier prices require the normal Accountant and General Manager approvals.</p></div></div>}{dialog === 'category' && <div className="grid gap-4"><div className="grid gap-3 rounded-md border p-3"><Input placeholder="New category name" value={categoryDraft.name} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryAllOutlets} onChange={(e) => setCategoryAllOutlets(e.target.checked)} />Create this category on every active outlet</label>{!categoryAllOutlets && <select className="h-10 rounded-md border bg-background px-3" value={categoryDraft.outletId} onChange={(e) => setCategoryDraft({ ...categoryDraft, outletId: e.target.value })}><option value="">Select outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select>}<Button onClick={() => void saveCategory()} disabled={saving || (!categoryAllOutlets && !categoryDraft.outletId)}>{saving ? 'Saving...' : categoryAllOutlets ? 'Create on all outlets' : 'Create category'}</Button></div><div className="max-h-64 space-y-2 overflow-y-auto">{categories.map((category) => <div key={category.id} className="flex items-center gap-2"><Input value={categoryEdits[category.id] ?? category.name} onChange={(e) => setCategoryEdits({ ...categoryEdits, [category.id]: e.target.value })} /><Button variant="outline" size="sm" onClick={() => void updateCategory(category)}>Save</Button><Button variant="ghost" size="sm" onClick={() => void toggleCategory(category)}>{category.isActive ? 'Deactivate' : 'Activate'}</Button></div>)}</div></div>}</div></div>}
  </div>;
}

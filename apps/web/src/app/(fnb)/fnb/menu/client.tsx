'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreHorizontal, Loader2, Tags, ShieldCheck } from 'lucide-react';

type Product = any;
type Category = any;

function money(amount: number) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount); }

export function FnbMenuClient() {
  const { propertyId } = useProperty();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [inventoryFilter, setInventoryFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [dialog, setDialog] = useState<'item' | 'price' | 'category' | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [item, setItem] = useState({ name: '', price: '', taxRate: '0', categoryId: '', inventoryMode: 'NON_STOCK', productionStation: 'KITCHEN' });
  const [newPrice, setNewPrice] = useState('');
  const [categoryDraft, setCategoryDraft] = useState({ name: '', outletId: '', productionStation: 'KITCHEN' });
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
      setProducts(productsBody.data || []);
      setCategories(categoriesBody.data || []);
      setOutlets((outletsBody.data || []).filter((outlet: any) => outlet.propertyId === propertyId));
    } catch (err: any) { setError(err.message || 'Could not load menu items'); }
    finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [product.itemCode, product.name, product.category?.name].some((value) => String(value || '').toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'ALL' || product.categoryId === categoryFilter;
    const matchesAvailability = availabilityFilter === 'ALL' || (availabilityFilter === 'ACTIVE' ? product.isActive : !product.isActive);
    const matchesInventory = inventoryFilter === 'ALL' || product.inventoryMode === inventoryFilter;
    return matchesSearch && matchesCategory && matchesAvailability && matchesInventory;
  }), [products, search, categoryFilter, availabilityFilter, inventoryFilter]);

  const request = async (url: string, method: string, body: any) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || 'Request failed');
    return json;
  };

  const openAdd = () => { setEditing(null); setItem({ name: '', price: '', taxRate: '0', categoryId: categories[0]?.id || '', inventoryMode: 'NON_STOCK', productionStation: 'KITCHEN' }); setDialog('item'); };
  const openEdit = (product: Product) => { setEditing(product); setItem({ name: product.name, price: String(product.price), taxRate: String(product.taxRate || 0), categoryId: product.categoryId, inventoryMode: product.inventoryMode, productionStation: product.productionStation || 'KITCHEN' }); setDialog('item'); };

  const saveItem = async () => {
    setSaving(true); setMessage('');
    try {
      if (!item.name.trim() || !item.categoryId) throw new Error('Name and category are required');
      if (editing) {
        await request(`/api/v1/pos/products/${editing.id}`, 'PATCH', { name: item.name, categoryId: item.categoryId, taxRate: Number(item.taxRate), inventoryMode: item.inventoryMode });
        if (Number(item.price) !== Number(editing.price)) await request(`/api/v1/pos/products/${editing.id}/price-request`, 'POST', { price: Number(item.price), reason: 'Price change submitted from menu management' });
        setMessage(Number(item.price) !== Number(editing.price) ? 'Details saved; price is awaiting the three approval steps.' : 'Menu item updated.');
      } else {
        await request('/api/v1/pos/products/menu-request', 'POST', { propertyId, name: item.name, price: Number(item.price), taxRate: Number(item.taxRate), categoryId: item.categoryId, inventoryMode: item.inventoryMode, productionStation: item.productionStation });
        setMessage('New item submitted for approval.');
      }
      setDialog(null); await load();
    } catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const changePrice = async () => {
    if (!priceProduct) return;
    setSaving(true);
    try { await request(`/api/v1/pos/products/${priceProduct.id}/price-request`, 'POST', { price: Number(newPrice), reason: 'Price change submitted from menu management' }); setDialog(null); setMessage('Price change submitted: General Cashier → Accountant → General Manager.'); await load(); }
    catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (product: Product) => {
    try { await request(`/api/v1/pos/products/${product.id}`, 'PATCH', { isActive: !product.isActive }); setMessage(product.isActive ? 'Item 86’d.' : 'Item made available.'); await load(); }
    catch (err: any) { setMessage(err.message); }
  };

  const saveCategory = async () => {
    setSaving(true);
    try { await request('/api/v1/pos/categories', 'POST', { propertyId, ...categoryDraft }); setDialog(null); setMessage('Category created.'); await load(); }
    catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); }
  };
  const updateCategory = async (category: Category) => {
    try { await request(`/api/v1/pos/categories/${category.id}`, 'PATCH', { propertyId, name: categoryEdits[category.id] ?? category.name, isActive: category.isActive }); setMessage('Category updated.'); await load(); }
    catch (err: any) { setMessage(err.message); }
  };
  const toggleCategory = async (category: Category) => {
    try { await request(`/api/v1/pos/categories/${category.id}`, 'PATCH', { propertyId, isActive: !category.isActive }); setMessage(category.isActive ? 'Category deactivated.' : 'Category activated.'); await load(); }
    catch (err: any) { setMessage(err.message); }
  };

  return <div className="space-y-6 p-6">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-3xl font-bold tracking-tight">Menu Management</h1><p className="mt-1 text-muted-foreground">Property-scoped products, pricing, categories, and availability.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog('category')}><Tags className="mr-2 h-4 w-4" />Category</Button><Button variant="outline" asChild><a href="/admin/pos/price-approvals"><ShieldCheck className="mr-2 h-4 w-4" />Approvals</a></Button><Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Item</Button></div>
    </div>
    {(error || message) && <div className={`rounded-md border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
    <div className="rounded-lg border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search menu items..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button variant="outline" onClick={() => setShowFilters((value) => !value)}><Filter className="mr-2 h-4 w-4" />Filters</Button>{loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>{showFilters && <div className="mt-3 grid gap-2 sm:grid-cols-3"><select className="h-9 rounded-md border bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}><option value="ALL">All availability</option><option value="ACTIVE">Available</option><option value="INACTIVE">86’d</option></select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)}><option value="ALL">All inventory modes</option><option value="NON_STOCK">Non-stock</option><option value="STOCK">Stock</option><option value="PREPARED_RECIPE">Prepared recipe</option></select></div>}</div>
    <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-3 text-left">Item Code</th><th className="p-3 text-left">Name</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Availability</th><th className="p-3 text-right">Price</th><th className="p-3" /></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id} className={`border-b last:border-0 ${!product.isActive ? 'opacity-60' : ''}`}><td className="p-3 font-medium text-muted-foreground">{product.itemCode || product.id.slice(0, 8).toUpperCase()}</td><td className="p-3 font-semibold">{product.name}</td><td className="p-3">{product.category?.name || 'Uncategorized'}</td><td className="p-3">{product.inventoryMode}</td><td className="p-3">{!product.isActive ? <Badge variant="destructive">86’d</Badge> : product.stockStatus === 'OUT_OF_STOCK' ? <Badge variant="destructive">Out of stock</Badge> : <Badge>Available</Badge>}</td><td className="p-3 text-right font-medium">{money(Number(product.price))}</td><td className="p-3 text-right"><select aria-label={`Actions for ${product.name}`} className="h-8 rounded-md border bg-background px-2 text-xs" value="" onChange={(e) => { const action = e.target.value; if (action === 'edit') openEdit(product); if (action === 'price') { setPriceProduct(product); setNewPrice(String(product.price)); setDialog('price'); } if (action === 'toggle') void toggleActive(product); }}><option value=""><MoreHorizontal className="h-4 w-4" /></option><option value="edit">Edit details</option><option value="price">Request price change</option><option value="toggle">{product.isActive ? '86’d item' : 'Make available'}</option></select></td></tr>)}{!filteredProducts.length && !loading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No menu items found.</td></tr>}</tbody></table></div>
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg space-y-4 rounded-xl bg-background p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{dialog === 'item' ? (editing ? 'Edit menu item' : 'Request new menu item') : dialog === 'price' ? 'Request price change' : 'Category management'}</h2><Button variant="ghost" onClick={() => setDialog(null)}>×</Button></div>{dialog === 'item' && <div className="grid gap-3"><Input placeholder="Item name" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /><Input type="number" placeholder="Selling price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} disabled={!!editing} /><select className="h-10 rounded-md border bg-background px-3" value={item.categoryId} onChange={(e) => setItem({ ...item, categoryId: e.target.value })}><option value="">Select category</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input type="number" placeholder="Tax rate %" value={item.taxRate} onChange={(e) => setItem({ ...item, taxRate: e.target.value })} /><Button onClick={() => void saveItem()} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save details' : 'Submit for approval'}</Button></div>}{dialog === 'price' && <div className="grid gap-3"><p className="text-sm text-muted-foreground">{priceProduct?.name}: current price {money(Number(priceProduct?.price || 0))}. Price changes require General Cashier, Accountant, then General Manager approval.</p><Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /><Button onClick={() => void changePrice()} disabled={saving}>{saving ? 'Submitting...' : 'Submit price request'}</Button></div>}{dialog === 'category' && <div className="grid gap-4"><div className="grid gap-3 rounded-md border p-3"><Input placeholder="New category name" value={categoryDraft.name} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} /><select className="h-10 rounded-md border bg-background px-3" value={categoryDraft.outletId} onChange={(e) => setCategoryDraft({ ...categoryDraft, outletId: e.target.value })}><option value="">Select outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select><Button onClick={() => void saveCategory()} disabled={saving}>{saving ? 'Saving...' : 'Create category'}</Button></div><div className="max-h-64 space-y-2 overflow-y-auto">{categories.map((category) => <div key={category.id} className="flex items-center gap-2"><Input value={categoryEdits[category.id] ?? category.name} onChange={(e) => setCategoryEdits({ ...categoryEdits, [category.id]: e.target.value })} /><Button variant="outline" size="sm" onClick={() => void updateCategory(category)}>Save</Button><Button variant="ghost" size="sm" onClick={() => void toggleCategory(category)}>{category.isActive ? 'Deactivate' : 'Activate'}</Button></div>)}</div></div>}</div></div>}
  </div>;
}

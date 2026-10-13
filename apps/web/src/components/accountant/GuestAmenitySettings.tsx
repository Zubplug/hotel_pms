'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Package, Save } from 'lucide-react';
import { toast } from 'sonner';

type StockItem = { id: string; name: string; warehouseId: string; baseUnit: string; costPrice: number; quantityOnHand: number };
type Amenity = { key: string; name: string; stockItemId: string; quantityPerGuest: number; expectedCost: number; aliases?: string[] };

export function GuestAmenitySettings({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [items, setItems] = useState<Amenity[]>([]);

  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/v1/properties/${propertyId}/guest-amenity-settings`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load guest amenity settings');
        const housekeeping = (body.warehouses || []).filter((warehouse: any) => /housekeeping|laundry/i.test(warehouse.name));
        setWarehouses(housekeeping);
        setStockItems(body.stockItems || []);
        const configured = body.guestAmenities || {};
        setEnabled(configured.enabled !== false);
        const selectedWarehouseId = configured.warehouseId || housekeeping[0]?.id || '';
        setWarehouseId(selectedWarehouseId);
        const warehouseStock = (body.stockItems || []).filter((item: StockItem) => item.warehouseId === selectedWarehouseId);
        setItems((configured.items || []).map((item: any) => {
          const names = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])].filter(Boolean).map(String);
          const matched = warehouseStock.find((stock: StockItem) => names.some((name) => normalize(name) === normalize(stock.name)));
          const displayName = item.key === 'bottle-water' ? 'Complimentary Water' : item.name;
          return { ...item, name: displayName, stockItemId: item.stockItemId || matched?.id || '', quantityPerGuest: Number(item.quantityPerGuest ?? item.quantityPerRoom ?? 1), expectedCost: Number(item.expectedCost ?? 0) };
        }));
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const warehouseItems = useMemo(() => stockItems.filter((item) => item.warehouseId === warehouseId), [stockItems, warehouseId]);
  const updateItem = (index: number, patch: Partial<Amenity>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/guest-amenity-settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestAmenities: { enabled, warehouseId, items } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save guest amenity settings');
      toast.success('Guest amenity settings saved');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /></div>;

  return <div className="space-y-5 rounded-xl border border-white/10 bg-white/[.03] p-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><Package className="h-5 w-5 text-amber-400" />Complimentary Guest Amenities</h2><p className="mt-1 max-w-2xl text-sm text-slate-400">One complimentary amenity pack per registered guest. Stock is deducted at cost during night audit from the selected housekeeping/laundry warehouse.</p></div>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
    </div>
    <div><label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Stock outlet warehouse</label><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">Select housekeeping/laundry warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
    <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Stock item</th><th className="px-3 py-3">Qty / guest</th><th className="px-3 py-3">Standard cost</th><th className="px-3 py-3">On hand</th></tr></thead><tbody className="divide-y divide-white/10">{items.map((item, index) => { const stock = stockItems.find((candidate) => candidate.id === item.stockItemId); return <tr key={`${item.key}-${index}`}><td className="px-3 py-3 font-medium text-white">{item.name}</td><td className="px-3 py-3"><select value={item.stockItemId} onChange={(event) => updateItem(index, { stockItemId: event.target.value })} className="w-full rounded border border-white/10 bg-slate-900 px-2 py-1.5 text-slate-200"><option value="">Select stock item</option>{warehouseItems.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></td><td className="px-3 py-3"><input type="number" min="0" step="1" value={item.quantityPerGuest} onChange={(event) => updateItem(index, { quantityPerGuest: Number(event.target.value) })} className="w-24 rounded border border-white/10 bg-slate-900 px-2 py-1.5 text-white" /></td><td className="px-3 py-3 text-amber-300">₦{Number(stock?.costPrice || item.expectedCost || 0).toLocaleString()}</td><td className="px-3 py-3 text-slate-300">{stock ? `${stock.quantityOnHand} ${stock.baseUnit}` : 'Not mapped'}</td></tr>})}</tbody></table></div>
    <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Guest folios remain free; inventory and COGS are recorded automatically.</p><button type="button" onClick={() => void save()} disabled={saving || !warehouseId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save settings'}</button></div>
  </div>;
}

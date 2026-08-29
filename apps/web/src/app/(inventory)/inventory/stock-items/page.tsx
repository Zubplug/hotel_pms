import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Boxes, Plus, Edit, Eye } from 'lucide-react';

const STOCK_TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'SELLABLE', label: 'Sellable' },
  { value: 'RAW_MATERIAL', label: 'Raw materials' },
  { value: 'CONSUMABLE', label: 'Consumables' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'ASSET', label: 'Assets' },
  { value: 'PACKAGING', label: 'Packaging' },
] as const;

const stockTypeLabel = (value: string) => STOCK_TYPE_FILTERS.find((type) => type.value === value)?.label || value;

function StockStatusBadge({ qty, reorderLevel }: { qty: number; reorderLevel: number | null }) {
  if (qty <= 0)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
        Out of Stock
      </span>
    );
  if (reorderLevel && qty <= reorderLevel)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        Low Stock
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      In Stock
    </span>
  );
}

export default async function StockItemsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await auth();
  if (!session?.user?.propertyId) return null;
  const params = await searchParams;
  const selectedType = STOCK_TYPE_FILTERS.some((type) => type.value === params.type) ? params.type : '';

  const stockItems = await prisma.stockItem.findMany({
    where: { propertyId: session.user.propertyId, isActive: true, ...(selectedType ? { stockType: selectedType as any } : {}) },
    include: {
      warehouse: { select: { name: true } },
      inventoryCategory: { select: { name: true } },
      posProduct: { select: { category: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Stock Items</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your inventory catalogue and stock levels.</p>
          </div>
          <Link
            href="/inventory/stock-items/new"
            className="inline-flex items-center gap-2 bg-white text-slate-800 border border-white/20 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Item
          </Link>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{selectedType ? stockTypeLabel(selectedType) : 'All Stock Items'}</span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {stockItems.length}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-slate-100">
            {STOCK_TYPE_FILTERS.map((type) => (
              <Link key={type.value || 'all'} href={type.value ? `/inventory/stock-items?type=${type.value}` : '/inventory/stock-items'} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${selectedType === type.value ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {type.label}
              </Link>
            ))}
          </div>

          {stockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Boxes className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No stock items yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first item to start tracking inventory.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Name', 'SKU / Barcode', 'Warehouse', 'Type', 'Category', 'Cost Price', 'Qty on Hand', 'Status', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider ${
                            i >= 5 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-6 py-4">
                        <p className="text-slate-700 font-mono text-xs">{item.sku || '—'}</p>
                        {item.barcode && <p className="text-xs text-slate-400">{item.barcode}</p>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.warehouse?.name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${item.stockType === 'SELLABLE' ? 'bg-emerald-100 text-emerald-700' : item.stockType === 'ASSET' ? 'bg-purple-100 text-purple-700' : item.stockType === 'CLEANING' || item.stockType === 'HOUSEKEEPING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {stockTypeLabel(item.stockType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.inventoryCategory?.name ||
                            item.posProduct?.category?.name ||
                            'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700 font-medium">
                        ₦{item.costPrice?.toString() || '0.00'}
                        <span className="text-slate-400 font-normal text-xs ml-1">/ {item.baseUnit}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {item.quantityOnHand?.toString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StockStatusBadge
                          qty={Number(item.quantityOnHand)}
                          reorderLevel={item.reorderLevel ? Number(item.reorderLevel) : null}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/inventory/stock-items/${item.id}/edit`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/inventory/stock-items/${item.id}`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

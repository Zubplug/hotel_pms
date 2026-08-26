import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Search, Plus, Eye, Edit } from 'lucide-react';

function StockStatusBadge({ qty, reorderLevel }: { qty: number; reorderLevel: number | null }) {
  if (qty <= 0) return <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-500 rounded-full">Out of Stock</span>;
  if (reorderLevel && qty <= reorderLevel) return <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">Low Stock</span>;
  return <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-full">In Stock</span>;
}

export default async function StockItemsPage() {
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const stockItems = await prisma.stockItem.findMany({
    where: { propertyId: session.user.propertyId, isActive: true },
    include: { warehouse: { select: { name: true } } }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Stock Items</h1>
          <p className="text-zinc-400">Manage your inventory and stock levels.</p>
        </div>
        <Link href="/inventory/stock-items/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" /> New Item
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input type="text" placeholder="Search stock items..." className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">SKU / Barcode</th>
                <th className="px-6 py-3 font-medium">Warehouse</th>
                <th className="px-6 py-3 font-medium text-right">Cost Price</th>
                <th className="px-6 py-3 font-medium text-right">Qty on Hand</th>
                <th className="px-6 py-3 font-medium text-center">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {stockItems.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-zinc-100">{item.name}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    <div>{item.sku || '-'}</div>
                    <div className="text-xs text-zinc-500">{item.barcode}</div>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{item.warehouse?.name || '-'}</td>
                  <td className="px-6 py-4 text-right text-zinc-300">
                    ${item.costPrice?.toString() || '0.00'} <span className="text-zinc-500 text-xs">/ {item.baseUnit}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-100">{item.quantityOnHand?.toString()}</td>
                  <td className="px-6 py-4 text-center">
                    <StockStatusBadge qty={Number(item.quantityOnHand)} reorderLevel={item.reorderLevel ? Number(item.reorderLevel) : null} />
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link href={`/inventory/stock-items/${item.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors" title="View Ledger">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {stockItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No stock items found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

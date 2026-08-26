import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Package, ArrowLeft, Activity, Tag, BarChart2, Building2 } from 'lucide-react';

export default async function StockItemDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const item = await prisma.stockItem.findUnique({
    where: { id: params.id, propertyId: session.user.propertyId },
    include: {
      warehouse: true,
      inventoryCategory: true,
      posProduct: { select: { category: { select: { name: true } } } }
    }
  });

  if (!item) {
    notFound();
  }

  const transactions = await prisma.stockTransaction.findMany({
    where: { stockItemId: item.id },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  const categoryName = item.inventoryCategory?.name || item.posProduct?.category?.name || 'Uncategorized';
  const totalValue = Number(item.quantityOnHand) * Number(item.costPrice);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/inventory/stock-items" className="p-2 bg-white border border-slate-200 rounded-md text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{item.name}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {item.warehouse?.name}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href={`/inventory/reconciliation?item=${item.id}`} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm rounded-md transition-colors">
            Adjust Stock
          </Link>
          <Link href={`/inventory/stock-items/${item.id}/edit`} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm rounded-md transition-colors">
            Edit Item
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Qty On Hand</p>
            <p className="text-2xl font-bold text-slate-900">{Number(item.quantityOnHand).toFixed(2)} <span className="text-sm font-normal text-slate-500">{item.baseUnit}</span></p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Value</p>
            <p className="text-2xl font-bold text-slate-900">₦{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Cost Price</p>
            <p className="text-2xl font-bold text-slate-900">₦{Number(item.costPrice).toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Category</p>
            <p className="text-lg font-bold text-slate-900 mt-1 truncate">{categoryName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Item Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">SKU</span>
                <span className="font-medium text-slate-900">{item.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Barcode</span>
                <span className="font-medium text-slate-900">{item.barcode || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Reorder Level</span>
                <span className="font-medium text-slate-900">{item.reorderLevel ? Number(item.reorderLevel).toFixed(2) : 'Not set'}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Status</span>
                <span className="font-medium text-slate-900">{item.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
            </div>
            
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Source</th>
                      <th className="px-6 py-3 font-medium text-right">Qty Change</th>
                      <th className="px-6 py-3 font-medium text-right">Balance</th>
                      <th className="px-6 py-3 font-medium">Ref / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-900 whitespace-nowrap">
                          {tx.timestamp.toLocaleDateString()} {tx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {tx.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${Number(tx.quantity) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {Number(tx.quantity) > 0 ? '+' : ''}{Number(tx.quantity).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {Number(tx.quantityAfter).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs max-w-[200px] truncate">
                          {tx.reference || tx.notes || '-'}
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
    </div>
  );
}

import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { Plus, Search, FileText } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  SUBMITTED: 'bg-blue-50 text-blue-600 border-blue-500/20',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-600 border-amber-500/20',
  RECEIVED: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  REJECTED: 'bg-red-50 text-red-600 border-red-500/20',
  CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export default async function PurchaseOrdersPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) return <div>No property selected</div>;

  const pos = await prisma.purchaseOrder.findMany({
    where: { propertyId },
    include: {
      supplier: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Manage purchase orders and track deliveries</p>
        </div>
        <Link
          href="/inventory/purchase-orders/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-slate-900 px-4 py-2 rounded-md transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </Link>
      </div>

      <div className="bg-white border border-slate-800 rounded-xl overflow-hidden">
        {pos.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No purchase orders</h3>
            <p className="text-slate-500 text-sm max-w-sm">Create a purchase order to start replenishing your stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">PO Number</th>
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Total Amount</th>
                  <th className="px-6 py-4 font-medium">Items</th>
                  <th className="px-6 py-4 font-medium">Expected Date</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pos.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/inventory/purchase-orders/${po.id}`} className="font-semibold text-blue-600 hover:text-blue-300">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-900">{po.supplier.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {po.propertyId} {po.totalAmount?.toNumber().toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{po._count?.items ?? 0}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/inventory/purchase-orders/${po.id}`}
                        className="text-blue-600 hover:text-blue-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View Details &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

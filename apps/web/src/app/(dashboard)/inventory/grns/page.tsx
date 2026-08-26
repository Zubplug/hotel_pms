import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  POSTED: 'bg-green-500/10 text-green-400 border-green-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default async function GRNsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) return <div>No property selected</div>;

  const grns = await prisma.goodsReceivedNote.findMany({
    where: { propertyId },
    include: {
      purchaseOrder: { select: { poNumber: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Goods Received Notes</h1>
        <p className="text-slate-400 text-sm mt-1">Track inventory receipts and incoming stock</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {grns.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <PackageSearch className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No GRNs found</h3>
            <p className="text-slate-400 text-sm max-w-sm">Receive items from approved purchase orders to generate a GRN.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">GRN Number</th>
                  <th className="px-6 py-4 font-medium">Linked PO</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Items Count</th>
                  <th className="px-6 py-4 font-medium">Received Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {grns.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{grn.grnNumber}</td>
                    <td className="px-6 py-4">
                      {grn.purchaseOrder ? (
                        <Link href={`/inventory/purchase-orders/${grn.purchaseOrderId}`} className="text-blue-400 hover:text-blue-300">
                          {grn.purchaseOrder.poNumber}
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[grn.status] || STATUS_COLORS.DRAFT}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{grn._count.items}</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(grn.receivedDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/inventory/grns/${grn.id}`}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View &rarr;
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

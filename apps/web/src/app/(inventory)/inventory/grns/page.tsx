import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { PackageSearch, Calendar, FileText, ArrowRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-500/20',
  POSTED: 'bg-emerald-50 text-emerald-700 border-emerald-500/20',
  CANCELLED: 'bg-slate-50 text-slate-700 border-slate-500/20',
};

export default async function GRNsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) return <div>No property selected</div>;

  const grns = await prisma.goodsReceivedNote.findMany({
    where: { propertyId },
    include: {
      purchaseOrder: { select: { poNumber: true, expectedDate: true } },
      _count: { select: { items: true } },
      items: {
        select: {
          receivedQty: true,
          unitCost: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Goods Receipt Notes</h1>
          <p className="text-slate-500 text-sm mt-1">Track inventory receipts and warehouse deliveries</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {grns.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50/50 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-blue-500/10">
              <PackageSearch className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No GRNs found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              Goods Receipt Notes (GRNs) are created when you receive items from approved Purchase Orders. 
              Go to a Purchase Order to create your first GRN.
            </p>
            <Link 
              href="/inventory/purchase-orders" 
              className="mt-6 inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl transition-colors text-sm font-medium shadow-sm"
            >
              View Purchase Orders <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-4 font-semibold">GRN Reference</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Linked PO</th>
                  <th className="px-6 py-4 font-semibold">Received Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Items</th>
                  <th className="px-6 py-4 font-semibold text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grns.map((grn) => {
                  const totalValue = grn.items.reduce((sum, item) => sum + (Number(item.receivedQty) * Number(item.unitCost)), 0);
                  
                  return (
                    <tr key={grn.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/inventory/grns/${grn.id}`} className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                          {grn.grnNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_COLORS[grn.status] || STATUS_COLORS.DRAFT}`}>
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {grn.purchaseOrder ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <Link href={`/inventory/purchase-orders/${grn.purchaseOrderId}`} className="text-slate-600 hover:text-slate-900 font-medium">
                              {grn.purchaseOrder.poNumber}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(grn.receivedDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                          {grn._count.items}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700">
                        {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { Truck, Calendar, FileText, ArrowRight } from 'lucide-react';

const STATUS_META: Record<string, { label: string; classes: string }> = {
  DRAFT:     { label: 'Draft',     classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Submitted', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED:  { label: 'Approved', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
  POSTED:    { label: 'Posted',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:  { label: 'Rejected',  classes: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
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
      items: { select: { receivedQty: true, unitCost: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Goods Receipt Notes</h1>
          <p className="text-slate-400 text-sm mt-1">Track inventory receipts and warehouse deliveries.</p>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <Truck className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">All GRNs</span>
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {grns.length}
            </span>
          </div>

          {grns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Truck className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No GRNs yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Goods Receipt Notes are created when items are received from approved Purchase Orders.
              </p>
              <Link
                href="/inventory/purchase-orders"
                className="mt-5 inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
              >
                View Purchase Orders <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['GRN Reference', 'Status', 'Linked PO', 'Received Date', 'Items', 'Value'].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                            i >= 4 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grns.map((grn) => {
                    const totalValue = grn.items.reduce(
                      (sum, item) => sum + Number(item.receivedQty) * Number(item.unitCost),
                      0
                    );
                    const meta = STATUS_META[grn.status] ?? STATUS_META.DRAFT;
                    return (
                      <tr key={grn.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <Link
                            href={`/inventory/grns/${grn.id}`}
                            className="font-mono font-bold text-blue-700 hover:text-blue-900 text-xs"
                          >
                            {grn.grnNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {grn.purchaseOrder ? (
                            <Link
                              href={`/inventory/purchase-orders/${grn.purchaseOrderId}`}
                              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              {grn.purchaseOrder.poNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic text-xs">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(grn.receivedDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                            {grn._count.items}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
    </div>
  );
}

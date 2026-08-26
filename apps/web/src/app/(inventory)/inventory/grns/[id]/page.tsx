import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, FileText, FileInput } from 'lucide-react';
import { PostGrnButton } from './PostGrnButton';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-600 border-amber-500/20',
  POSTED: 'bg-green-500/10 text-green-400 border-green-500/20',
  CANCELLED: 'bg-red-50 text-red-600 border-red-500/20',
};

export default async function GRNDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.propertyId) return <div>No property selected</div>;

  const grn = await prisma.goodsReceivedNote.findUnique({
    where: { id: params.id },
    include: {
      purchaseOrder: { select: { poNumber: true, id: true } },
      items: true,
    }
  }) as any;

  if (!grn || grn.propertyId !== session.user.propertyId) {
    notFound();
  }

  const grandTotal = grn.items.reduce((sum: number, item: any) => sum + (item.receivedQuantity * Number(item.unitCost || 0)), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-800 rounded-xl p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">{grn.grnNumber}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[grn.status] || STATUS_COLORS.DRAFT}`}>
              {grn.status}
            </span>
          </div>
          <p className="text-slate-500 flex items-center gap-2">
            Received Date: {new Date(grn.receivedDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {grn.purchaseOrder && (
            <Link 
              href={`/inventory/purchase-orders/${grn.purchaseOrderId}`}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              PO: {grn.purchaseOrder.poNumber}
            </Link>
          )}
          {grn.status === 'DRAFT' && <PostGrnButton id={grn.id} />}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Received Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Stock Item</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium text-right">Received Qty</th>
                <th className="px-6 py-4 font-medium">Unit</th>
                <th className="px-6 py-4 font-medium text-right">Unit Cost</th>
                <th className="px-6 py-4 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {grn.items.map((item: any) => {
                const lineTotal = item.receivedQuantity * Number(item.unitCost || 0);
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.stockItem?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{item.description || '-'}</td>
                    <td className="px-6 py-4 text-slate-700 text-right font-medium">{item.receivedQuantity}</td>
                    <td className="px-6 py-4 text-slate-700">{item.uom}</td>
                    <td className="px-6 py-4 text-slate-700 text-right">{Number(item.unitCost).toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-700 text-right font-medium">{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-950/50 border-t border-slate-800">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-right font-semibold text-slate-900">Grand Total:</td>
                <td className="px-6 py-4 text-right font-bold text-blue-600 text-lg">
                  ${grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

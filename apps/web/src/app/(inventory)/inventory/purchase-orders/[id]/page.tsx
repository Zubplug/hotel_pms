import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import { Building2, Calendar, DollarSign, FileText } from 'lucide-react';
import { POActionBar } from './ActionBar';
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

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.propertyId) return <div>No property selected</div>;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: true,
      grns: { select: { id: true, grnNumber: true, status: true, receivedDate: true, items: true } },
      property: { select: { baseCurrency: true } }
    }
  }) as any;

  if (!po || po.propertyId !== session.user.propertyId) {
    notFound();
  }

  // Check if user has PO approval permission
  const userRole = (session.user as any)?.role || '';
  const isSuperAdmin = (session.user as any)?.isSuperAdmin;
  const canApprove = isSuperAdmin || ['CEO', 'SUPER_ADMIN', 'MANAGER'].includes(userRole);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">{po.poNumber}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT}`}>
              {po.status}
            </span>
          </div>
          <p className="text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {po.supplier?.name} &bull; Created {new Date(po.createdAt).toLocaleDateString()}
          </p>
        </div>
        <POActionBar id={po.id} status={po.status} canApprove={canApprove} />
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Expected Delivery</p>
            <p className="text-sm font-semibold text-slate-900">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'Not set'}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Amount</p>
            <p className="text-sm font-semibold text-slate-900">{po.property?.baseCurrency} {po.totalAmount?.toNumber().toFixed(2) || '0.00'}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-medium text-slate-500">Notes</p>
            <p className="text-sm font-medium text-slate-900 truncate">{po.notes || 'No notes'}</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Item</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium text-right">Qty</th>
                <th className="px-6 py-4 font-medium">UOM</th>
                <th className="px-6 py-4 font-medium text-right">Unit Price</th>
                <th className="px-6 py-4 font-medium text-right">Total</th>
                <th className="px-6 py-4 font-medium text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-100 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.description || 'Item'}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{item.description || '-'}</td>
                  <td className="px-6 py-4 text-slate-700 text-right">{Number(item.quantity).toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-700">{item.unitOfMeasure}</td>
                  <td className="px-6 py-4 text-slate-700 text-right">{Number(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-700 text-right">{Number(item.totalPrice || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-700">
                      {Number(item.receivedQty || 0).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRNs */}
      {(po.grns || []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Goods Received Notes (GRNs)</h2>
          </div>
          <div className="divide-y divide-slate-200 p-4">
            {po.grns.map((grn: any) => (
              <div key={grn.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 mb-2 last:mb-0">
                <div>
                  <Link href={`/inventory/grns/${grn.id}`} className="font-semibold text-blue-600 hover:text-blue-300 block mb-1">
                    {grn.grnNumber}
                  </Link>
                  <p className="text-xs text-slate-500">Received on {grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">{grn.items?.length || 0} items</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    grn.status === 'POSTED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    grn.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-500/20' :
                    'bg-amber-50 text-amber-600 border-amber-500/20'
                  }`}>
                    {grn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

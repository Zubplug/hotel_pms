import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, Building2, Package, ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { GrnActionBar } from './GrnActionBar';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-500/20',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-500/20',
  APPROVED: 'bg-purple-50 text-purple-700 border-purple-500/20',
  POSTED: 'bg-emerald-50 text-emerald-700 border-emerald-500/20',
  CANCELLED: 'bg-slate-50 text-slate-700 border-slate-500/20',
  REJECTED: 'bg-red-50 text-red-700 border-red-500/20',
};

export default async function GRNDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.propertyId) return <div>No property selected</div>;

  const role = (session.user as any).role;
  const isSuperAdmin = (session.user as any).isSuperAdmin;
  const canReceive = hasInventoryPermission(role, 'inventory.receive', isSuperAdmin);
  const canApprove = hasInventoryPermission(role, 'inventory.approve', isSuperAdmin);
  const canPost = hasInventoryPermission(role, 'inventory.post', isSuperAdmin);

  const grn = await prisma.goodsReceivedNote.findUnique({
    where: { id },
    include: {
      property: { select: { baseCurrency: true } },
      purchaseOrder: { include: { supplier: true } },
      items: { include: { stockItem: true } },
    }
  }) as any;

  if (!grn || grn.propertyId !== session.user.propertyId) {
    notFound();
  }

  const grandTotal = grn.items.reduce((sum: number, item: any) => sum + (Number(item.receivedQty) * Number(item.unitCost || 0)), 0);
  const totalItems = grn.items.length;
  const currency = grn.property?.baseCurrency || 'NGN';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/inventory/grns" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to GRNs
      </Link>

      {/* Header Card */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50/50 rounded-xl flex items-center justify-center ring-1 ring-blue-500/10">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{grn.grnNumber}</h1>
                <p className="text-slate-500 text-sm font-medium">Goods Receipt Note</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${STATUS_COLORS[grn.status] || STATUS_COLORS.DRAFT}`}>
                  {grn.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-400">Date:</span>
                <span className="text-slate-900">{new Date(grn.receivedDate).toLocaleDateString()}</span>
              </div>
              {grn.deliveryNoteRef && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-400">DN Ref:</span>
                  <span className="text-slate-900 font-mono">{grn.deliveryNoteRef}</span>
                </div>
              )}
            </div>

            {/* Audit Trail Details */}
            {grn.status !== 'DRAFT' && (
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                {grn.submittedAt && (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Submitted {new Date(grn.submittedAt).toLocaleDateString()}
                  </div>
                )}
                {grn.approvedAt && (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    Approved {new Date(grn.approvedAt).toLocaleDateString()}
                  </div>
                )}
                {grn.rejectedAt && (
                  <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    Rejected {new Date(grn.rejectedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
            
            {grn.status === 'REJECTED' && grn.rejectedReason && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                <strong>Rejection Reason:</strong> {grn.rejectedReason}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-4 min-w-[200px]">
            {grn.purchaseOrder && (
              <div className="bg-slate-50 rounded-xl p-4 w-full border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Linked Order</p>
                <Link 
                  href={`/inventory/purchase-orders/${grn.purchaseOrderId}`}
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 text-slate-900 font-medium group-hover:text-blue-600 transition-colors">
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    {grn.purchaseOrder.poNumber}
                  </div>
                </Link>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{grn.purchaseOrder.supplier?.name}</span>
                </p>
              </div>
            )}
            
            <GrnActionBar 
              id={grn.id} 
              status={grn.status}
              itemCount={totalItems} 
              warehouseName={grn.items[0]?.stockItem?.warehouseId ? 'Destination Warehouse' : 'Stock'} 
              canReceive={canReceive}
              canApprove={canApprove}
              canPost={canPost}
            />

            {grn.status === 'POSTED' && (
              <div className="flex items-center justify-center w-full gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-500/20 shadow-sm">
                <CheckCircle2 className="w-5 h-5" /> Posted to Stock
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Received Items</h2>
          <span className="text-sm font-medium text-slate-500">{totalItems} Line Item{totalItems !== 1 && 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-4 font-semibold">Stock Item</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Received Qty</th>
                <th className="px-6 py-4 font-semibold">Unit</th>
                <th className="px-6 py-4 font-semibold text-right">Unit Cost</th>
                <th className="px-6 py-4 font-semibold text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {grn.items.map((item: any) => {
                const lineTotal = Number(item.receivedQty) * Number(item.unitCost || 0);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{item.stockItem?.name || 'Unknown Item'}</p>
                      {item.stockItem?.sku && <p className="text-xs text-slate-400 font-mono mt-0.5">{item.stockItem.sku}</p>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{item.description || '-'}</td>
                    <td className="px-6 py-4 text-slate-900 text-right font-semibold">
                      <span className="bg-slate-100 px-2 py-1 rounded-md text-slate-700">{Number(item.receivedQty).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.unitOfMeasure}</td>
                    <td className="px-6 py-4 text-slate-600 text-right">{Number(item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-slate-900 text-right font-medium">{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t border-slate-200/80">
              <tr>
                <td colSpan={5} className="px-6 py-5 text-right font-medium text-slate-500 uppercase tracking-wider text-xs">Total Value:</td>
                <td className="px-6 py-5 text-right font-bold text-slate-900 text-lg">
                  {currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

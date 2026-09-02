import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { Plus, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STATUS_META: Record<string, { label: string; classes: string }> = {
  DRAFT:              { label: 'Draft',               classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  SUBMITTED:          { label: 'Submitted',           classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED:           { label: 'Approved',            classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PARTIALLY_RECEIVED: { label: 'Partially Received',  classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED:           { label: 'Received',            classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  REJECTED:           { label: 'Rejected',            classes: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED:          { label: 'Cancelled',           classes: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) return <div>No property selected</div>;

  const requestedStatus = (await searchParams).status;
  const status = requestedStatus && ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'].includes(requestedStatus)
    ? requestedStatus
    : undefined;

  const pos = await prisma.purchaseOrder.findMany({
    where: { propertyId, ...(status ? { status: status as any } : {}) },
    include: { supplier: true, items: { select: { stockItemId: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  }) as any[];

  const stockItemIds = Array.from(new Set(pos.flatMap((po) => po.items.map((item: any) => item.stockItemId).filter(Boolean))));
  const stockItems = await prisma.stockItem.findMany({ where: { id: { in: stockItemIds } }, select: { id: true, stockType: true } });
  const stockTypeById = new Map(stockItems.map((item) => [item.id, item.stockType]));

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Purchase Orders</h1>
            <p className="text-slate-400 text-sm mt-1">{status === 'SUBMITTED' ? 'Review purchase orders waiting for stage-1 approval.' : 'Manage purchase orders and track supplier deliveries.'}</p>
          </div>
          <Link
            href="/inventory/purchase-orders/new"
            className="inline-flex items-center gap-2 bg-white text-slate-800 border border-white/20 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">{status === 'SUBMITTED' ? 'Submitted for Approval' : 'All Purchase Orders'}</span>
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {pos.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100">
            <Link href="/inventory/purchase-orders" className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</Link>
            <Link href="/inventory/purchase-orders?status=SUBMITTED" className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === 'SUBMITTED' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>Pending Approval</Link>
            <Link href="/inventory/purchase-orders?status=APPROVED" className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>Approved</Link>
          </div>

          {pos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No purchase orders</p>
              <p className="text-sm text-slate-400 mt-1">Create a purchase order to start replenishing stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['PO Number', 'Supplier', 'Status', 'Total Amount', 'Items', 'Expected', 'Created', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                            i >= 3 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pos.map((po) => {
                    const meta = STATUS_META[po.status] ?? STATUS_META.DRAFT;
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-4">
                          <Link
                            href={`/inventory/purchase-orders/${po.id}`}
                            className="font-mono font-bold text-blue-700 hover:text-blue-900 text-xs"
                          >
                            {po.poNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">{po.supplier.name}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{po.totalAmount?.toNumber().toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '0.00'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {po._count?.items ?? 0}
                          </span>
                          {(Array.from(new Set(po.items.map((item: any) => stockTypeById.get(item.stockItemId) || 'CONSUMABLE'))) as string[]).map((type) => (
                            <span key={type} className="ml-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 capitalize">{type.replace('_', ' ').toLowerCase()}</span>
                          ))}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(po.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/inventory/purchase-orders/${po.id}`}
                            className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-all"
                          >
                            View <ArrowRight className="h-3 w-3" />
                          </Link>
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

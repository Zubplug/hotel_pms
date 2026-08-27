import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { notFound, redirect } from 'next/navigation';
import { Building2, FileText } from 'lucide-react';
import { CreateGrnForm } from './CreateGrnForm';

export default async function NewGRNPage(props: { searchParams: Promise<{ poId?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user?.propertyId) return <div>No property selected</div>;

  const poId = searchParams.poId;
  if (!poId) {
    redirect('/inventory/purchase-orders');
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      items: {
        include: {
          stockItem: true
        }
      }
    }
  }) as any;

  if (!po || po.propertyId !== session.user.propertyId) {
    notFound();
  }

  if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-500/20">
          Cannot create a GRN for a PO that is not APPROVED or PARTIALLY_RECEIVED. Current status: {po.status}
        </div>
      </div>
    );
  }

  const itemsWithRemaining = po.items.map((item: any) => ({
    id: item.id,
    stockItemId: item.stockItemId,
    description: item.description,
    quantity: Number(item.quantity),
    receivedQty: Number(item.receivedQty),
    remainingQty: Number(item.quantity) - Number(item.receivedQty),
    unitCost: Number(item.unitPrice),
    uom: item.unitOfMeasure,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create Goods Receipt Note</h1>
        <p className="text-slate-500 text-sm mt-1">Receive items against an approved Purchase Order</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 shadow-sm flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-slate-900">PO: {po.poNumber}</h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-600 border-blue-500/20">
              {po.status}
            </span>
          </div>
          <p className="text-slate-500 flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" /> {po.supplier?.name} &bull; Expected {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>

      <CreateGrnForm poId={po.id} items={itemsWithRemaining} />
    </div>
  );
}

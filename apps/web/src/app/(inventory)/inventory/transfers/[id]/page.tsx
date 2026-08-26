import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@hotel-pms/db';
import TransferActionBar from './TransferActionBar';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:            'bg-slate-700 text-slate-700',
  PENDING_APPROVAL: 'bg-blue-500/20 text-blue-600 border border-blue-500/30',
  APPROVED:         'bg-green-500/20 text-green-400 border border-green-500/30',
  POSTED:           'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  CANCELLED:        'bg-red-500/20 text-red-600 border border-red-500/30',
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const { propertyId, role, isSuperAdmin } = session.user as any;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse:   true,
      items: {
        include: {
          stockItem: { select: { name: true, baseUnit: true, quantityOnHand: true } }
        }
      },
    },
  });

  if (!transfer || transfer.propertyId !== propertyId) notFound();

  const canApprove = isSuperAdmin || ['CEO', 'SUPER_ADMIN', 'MANAGER'].includes(role);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{transfer.transferRef}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[transfer.status] || ''}`}>
              {transfer.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
          </p>
        </div>
        <TransferActionBar transferId={transfer.id} status={transfer.status} canApprove={canApprove} />
      </div>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-slate-500">From</span><p className="text-slate-900 font-medium mt-0.5">{transfer.fromWarehouse.name}</p></div>
        <div><span className="text-slate-500">To</span><p className="text-slate-900 font-medium mt-0.5">{transfer.toWarehouse.name}</p></div>
        <div><span className="text-slate-500">Created</span><p className="text-slate-900 font-medium mt-0.5">{new Date(transfer.createdAt).toLocaleDateString()}</p></div>
        {transfer.postedAt && <div><span className="text-slate-500">Posted</span><p className="text-teal-400 font-medium mt-0.5">{new Date(transfer.postedAt).toLocaleDateString()}</p></div>}
      </div>

      {transfer.notes && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-700">
          <span className="text-slate-500 font-medium">Notes: </span>{transfer.notes}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-300 bg-slate-50">
          <h2 className="font-semibold text-slate-900">Transfer Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Item</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Current Qty</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Transfer Qty</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Unit</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {transfer.items.map(item => (
              <tr key={item.id} className="hover:bg-slate-700/20">
                <td className="px-4 py-3 text-slate-900 font-medium">{item.stockItem.name}</td>
                <td className="px-4 py-3 text-slate-700">{Number(item.stockItem.quantityOnHand).toFixed(2)}</td>
                <td className="px-4 py-3 font-semibold text-blue-600">{Number(item.quantity).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-500">{item.unitOfMeasure}</td>
                <td className="px-4 py-3 text-slate-500">{item.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

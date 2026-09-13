import prisma from '@hotel-pms/db';
import { PackageOpen, CheckCircle2, CheckCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default async function ReceivingDashboard() {
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) return <div>No active property found.</div>;

  const grns = await prisma.goodsReceivedNote.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: 'desc' },
    include: {
      purchaseOrder: { include: { supplier: true } },
      items: true
    }
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700';
      case 'SUBMITTED': return 'bg-indigo-100 text-indigo-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'POSTED': return 'bg-teal-500/20 text-teal-300';
      case 'REJECTED': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <Link href="/fnb/purchasing" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600">
            <ChevronLeft className="h-4 w-4" /> Back to Purchasing
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
            <PackageOpen className="h-4 w-4" /> Receiving Desk
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Goods Received Notes (GRN)</h1>
        </div>
        <div className="flex gap-4">
          <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-emerald-600">
            + Receive PO
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Total GRNs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{grns.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Awaiting Inspection</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{grns.filter(g => g.status === 'SUBMITTED' || g.status === 'DRAFT').length}</p>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-600">Posted to Stock</p>
          <p className="mt-2 text-3xl font-bold text-teal-700">{grns.filter(g => g.status === 'POSTED').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-4">GRN Number</th>
              <th className="p-4">Linked PO</th>
              <th className="p-4">Supplier</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Items</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {grns.map(grn => (
              <tr key={grn.id} className="transition hover:bg-white">
                <td className="p-4 font-mono font-medium text-emerald-600">{grn.grnNumber}</td>
                <td className="p-4 font-mono text-indigo-600">{grn.purchaseOrder?.poNumber || '—'}</td>
                <td className="p-4 font-semibold text-slate-900">{grn.purchaseOrder?.supplier?.name || '—'}</td>
                <td className="p-4 text-slate-600">{grn.receivedDate?.toISOString().split('T')[0] || grn.createdAt.toISOString().split('T')[0]}</td>
                <td className="p-4 text-right font-mono text-slate-900">{grn.items.length}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${getStatusColor(grn.status)}`}>
                    {grn.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-slate-600 hover:text-emerald-700">Review</button>
                </td>
              </tr>
            ))}
            {grns.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-600">No Goods Received Notes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import prisma from '@hotel-pms/db';
import { Truck, CheckCircle, PackageOpen, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default async function PurchasingDashboard() {
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) return <div>No active property found.</div>;

  const pos = await prisma.purchaseOrder.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      items: true
    }
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700';
      case 'SUBMITTED': return 'bg-indigo-100 text-indigo-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'PARTIALLY_RECEIVED': return 'bg-amber-500/20 text-amber-300';
      case 'RECEIVED': return 'bg-teal-500/20 text-teal-300';
      case 'REJECTED': case 'CANCELLED': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
            <Truck className="h-4 w-4" /> Procurement
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Purchase Orders</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/fnb/purchasing/receiving" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/20">
            Receiving (GRN) Desk
          </Link>
          <Link href="/fnb/purchasing/new" className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-indigo-600">
            + New PO
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Total POs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pos.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Approval</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{pos.filter(p => p.status === 'SUBMITTED').length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Approved / Expected</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{pos.filter(p => p.status === 'APPROVED').length}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Partially Received</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{pos.filter(p => p.status === 'PARTIALLY_RECEIVED').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-4">PO Number</th>
              <th className="p-4">Supplier</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {pos.map(po => (
              <tr key={po.id} className="transition hover:bg-white">
                <td className="p-4 font-mono font-medium text-indigo-600">{po.poNumber}</td>
                <td className="p-4 font-semibold text-slate-900">{po.supplier.name}</td>
                <td className="p-4 text-slate-600">{po.createdAt.toISOString().split('T')[0]}</td>
                <td className="p-4 text-right font-mono text-slate-900 tabular-nums">
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(po.totalAmount))}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${getStatusColor(po.status)}`}>
                    {po.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-slate-600 hover:text-indigo-600">View</button>
                </td>
              </tr>
            ))}
            {pos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-600">No purchase orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

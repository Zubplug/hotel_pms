import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { ArrowLeftRight, Plus, ArrowRight, Send } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; classes: string }> = {
  DRAFT:            { label: 'Draft',            classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED:         { label: 'Approved',         classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  POSTED:           { label: 'Posted',           classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  CANCELLED:        { label: 'Cancelled',        classes: 'bg-red-50 text-red-700 border-red-200' },
};

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { propertyId, role, staffId } = session.user as any;

  const outletHeadFilter = String(role).toUpperCase() === 'OUTLET_HEAD' && staffId
    ? { toWarehouse: { posOutlet: { staffAccess: { some: { staffId } } } } }
    : {};

  const transfers = await prisma.stockTransfer.findMany({
    where: { propertyId, ...outletHeadFilter },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true, posOutlet: { select: { id: true, name: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Stock Transfers</h1>
            <p className="text-slate-400 text-sm mt-1">Move stock between warehouses and track transfer approvals.</p>
          </div>
          <Link
            href="/inventory/transfers/new"
            className="inline-flex items-center gap-2 bg-white text-slate-800 border border-white/20 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Transfer
          </Link>
          <Link
            href="/inventory/transfers/new?issue=outlet"
            className="inline-flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <Send className="h-4 w-4" />
            Issue to Outlet
          </Link>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <ArrowLeftRight className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">All Transfers</span>
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {transfers.length}
            </span>
          </div>

          {transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No transfers yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first stock transfer to move items between warehouses.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Reference', 'From', 'To', 'Items', 'Status', 'Date', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                          i >= 3 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map((t) => {
                    const meta = STATUS_META[t.status] ?? STATUS_META.DRAFT;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">{t.transferRef}</td>
                        <td className="px-6 py-4 text-slate-700">{t.fromWarehouse.name}</td>
                        <td className="px-6 py-4 text-slate-700">{t.toWarehouse.posOutlet?.name || t.toWarehouse.name}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {t._count.items}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/inventory/transfers/${t.id}`}
                            className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all"
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

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:            'bg-slate-700 text-slate-700',
  PENDING_APPROVAL: 'bg-blue-500/20 text-blue-600 border border-blue-500/30',
  APPROVED:         'bg-green-500/20 text-green-400 border border-green-500/30',
  POSTED:           'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  CANCELLED:        'bg-red-500/20 text-red-600 border border-red-500/30',
};

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { propertyId } = session.user as any;

  const transfers = await prisma.stockTransfer.findMany({
    where: { propertyId },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse:   { select: { name: true } },
      _count:        { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Transfers</h1>
            <p className="text-slate-500 text-sm mt-0.5">{transfers.length} transfer(s) on record</p>
          </div>
        </div>
        <Link href="/inventory/transfers/new" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-900 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> New Transfer
        </Link>
      </div>

      <div className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Ref</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">From</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">To</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Items</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {transfers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No transfers found. Create your first transfer.</td></tr>
            ) : transfers.map(t => (
              <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{t.transferRef}</td>
                <td className="px-4 py-3 text-slate-700">{t.fromWarehouse.name}</td>
                <td className="px-4 py-3 text-slate-700">{t.toWarehouse.name}</td>
                <td className="px-4 py-3 text-slate-500">{t._count.items} item(s)</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[t.status] || 'bg-slate-700 text-slate-700'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/inventory/transfers/${t.id}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

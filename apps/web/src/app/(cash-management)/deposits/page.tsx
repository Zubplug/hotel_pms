import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { DepositActionButton } from './deposit-action-button';
import { CreateDepositButton } from './create-deposit-button';
import { Landmark, Plus, ArrowRight } from 'lucide-react';

const statusMeta: Record<string, { label: string; classes: string }> = {
  RECONCILED: { label: 'Reconciled', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXCEPTION:  { label: 'Exception',  classes: 'bg-red-50 text-red-700 border-red-200' },
  DEPOSITED:  { label: 'Deposited',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING_HANDOVER: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default async function DepositsPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const allowedProperties = await getUserPropertyIds(actor.user.id);
  const [deposits, handedOverPos, handedOverFrontdesk] = await Promise.all([
    prisma.bankDeposit.findMany({
      where: { propertyId: { in: allowedProperties } },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { name: true } },
        allocations: {
          include: {
            posSession: { select: { controlStatus: true } },
            frontdeskSession: { select: { status: true } },
          },
        },
      },
    }),
    prisma.posSession.findMany({
      where: {
        propertyId: { in: allowedProperties },
        controlStatus: 'HANDED_OVER',
        bankDepositAllocations: { none: {} },
      },
      select: { id: true, propertyId: true },
    }),
    prisma.frontdeskSession.findMany({
      where: {
        propertyId: { in: allowedProperties },
        controlStatus: 'HANDED_OVER',
        bankDepositAllocations: { none: {} },
      },
      select: { id: true, propertyId: true },
    }),
  ]);

  const canCreate =
    allowedProperties.length === 1 &&
    (handedOverPos.length > 0 || handedOverFrontdesk.length > 0);

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#1e2d50] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Bank Deposits</h1>
            <p className="text-slate-400 text-sm mt-1">
              Create, submit, and reconcile deposits after physical cash handover.
            </p>
          </div>
          {canCreate && (
            <CreateDepositButton
              propertyId={allowedProperties[0]}
              posSessionIds={handedOverPos
                .filter((s) => s.propertyId === allowedProperties[0])
                .map((s) => s.id)}
              frontdeskSessionIds={handedOverFrontdesk
                .filter((s) => s.propertyId === allowedProperties[0])
                .map((s) => s.id)}
            />
          )}
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                All Deposits
              </span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {deposits.length}
              </span>
            </div>
          </div>

          {deposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Landmark className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No deposits yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Deposits will appear here once cash handovers are bundled for banking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Reference', 'Property', 'Bank / Account', 'Expected', 'Difference', 'Status', 'Shifts', 'Date', ''].map(
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
                  {deposits.map((d) => {
                    const diff = Number(d.difference);
                    const meta =
                      statusMeta[d.status] ?? { label: d.status, classes: 'bg-slate-100 text-slate-700 border-slate-200' };
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                          {d.depositReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{d.property.name}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {d.bankName || '—'} / {d.bankAccount || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{Number(d.expectedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        >
                          {d.difference !== null
                            ? `₦${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {d.allocations.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DepositActionButton depositId={d.id} currentStatus={d.status} />
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

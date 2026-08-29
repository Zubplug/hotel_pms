import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { ReceiveHandoverButton } from './receive-handover-button';
import { CreateHandoverButton } from './create-handover-button';
import { ArrowLeftRight } from 'lucide-react';

const statusMeta: Record<string, { label: string; classes: string }> = {
  PENDING:   { label: 'Pending Receipt', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Completed',       classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export default async function HandoversPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const allowedProperties = await getUserPropertyIds(actor.user.id);
  const [handovers, approvedPos, approvedFrontdesk] = await Promise.all([
    prisma.cashHandover.findMany({
      where: { propertyId: { in: allowedProperties } },
      orderBy: { handedOverAt: 'desc' },
      include: {
        handedOverBy: { select: { firstName: true, lastName: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        property: { select: { name: true } },
        posSessions: { select: { id: true, controlStatus: true, actualCash: true } },
        frontdeskSessions: { select: { id: true, status: true, declaredCash: true } },
      },
    }),
    prisma.posSession.findMany({
      where: {
        propertyId: { in: allowedProperties },
        controlStatus: { in: ['APPROVED', 'APPROVED_WITH_VARIANCE'] },
        cashHandoverId: null,
      },
      select: { id: true, propertyId: true },
    }),
    prisma.frontdeskSession.findMany({
      where: {
        propertyId: { in: allowedProperties },
        controlStatus: { in: ['APPROVED', 'APPROVED_WITH_VARIANCE'] },
        cashHandoverId: null,
      },
      select: { id: true, propertyId: true },
    }),
  ]);

  const canCreate =
    allowedProperties.length === 1 &&
    (approvedPos.length > 0 || approvedFrontdesk.length > 0);

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#1e2d50] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Payment Handovers</h1>
            <p className="text-slate-400 text-sm mt-1">
              Transfer approved operator shifts, cash, and payment receipts into General Cashier custody.
            </p>
          </div>
          {canCreate && (
            <CreateHandoverButton
              propertyId={allowedProperties[0]}
              posSessionIds={approvedPos
                .filter((s) => s.propertyId === allowedProperties[0])
                .map((s) => s.id)}
              frontdeskSessionIds={approvedFrontdesk
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
              <ArrowLeftRight className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">All Handovers</span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {handovers.length}
              </span>
            </div>
          </div>

          {handovers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No handovers yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Payment handovers will appear here once approved shifts are transferred to the general cashier.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {[
                      'Reference',
                      'Property',
                      'Cash / Receipts',
                      'Status',
                      'Handed Over By',
                      'Received By',
                      'Sessions',
                      'Date',
                      '',
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                          i >= 2 ? 'text-right' : 'text-left'
                        } ${
                          i === 8 ? 'sticky right-0 bg-slate-50/90 backdrop-blur-sm border-l border-slate-100 z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {handovers.map((h) => {
                    const meta =
                      statusMeta[h.status] ?? {
                        label: h.status,
                        classes: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                    const sessionCount =
                      h.posSessions.length + h.frontdeskSessions.length;
                    const paymentBreakdown = (h.paymentBreakdown || {}) as Record<string, { amount?: number; count?: number }>;
                    return (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                          {h.handoverReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{h.property.name}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{Number(h.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <div className="mt-1 flex flex-wrap justify-end gap-1">
                            {Object.entries(paymentBreakdown).map(([method, value]) => (
                              <span key={method} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {method.replace(/_/g, ' ')} ₦{Number(value.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {h.handedOverBy.firstName} {h.handedOverBy.lastName}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {h.receivedBy
                            ? `${h.receivedBy.firstName} ${h.receivedBy.lastName}`
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {sessionCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(h.handedOverAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right sticky right-0 bg-white border-l border-slate-100 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
                          <ReceiveHandoverButton
                            handoverId={h.id}
                            currentStatus={h.status}
                          />
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

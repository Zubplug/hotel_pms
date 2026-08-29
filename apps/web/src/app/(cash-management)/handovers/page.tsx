import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { ReceiveHandoverButton } from './receive-handover-button';

export default async function HandoversPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const allowedProperties = await getUserPropertyIds(actor.user.id);
  const handovers = await prisma.cashHandover.findMany({
    where: { propertyId: { in: allowedProperties } },
    orderBy: { handedOverAt: 'desc' },
    include: {
      handedOverBy: { select: { firstName: true, lastName: true } },
      receivedBy: { select: { firstName: true, lastName: true } },
      property: { select: { name: true } },
      posSessions: { select: { id: true, controlStatus: true, actualCash: true } },
      frontdeskSessions: { select: { id: true, status: true, declaredCash: true } }
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Cash Handovers Workspace</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-500">Reference</th>
              <th className="px-6 py-4 font-medium text-slate-500">Property</th>
              <th className="px-6 py-4 font-medium text-slate-500">Amount</th>
              <th className="px-6 py-4 font-medium text-slate-500">Status</th>
              <th className="px-6 py-4 font-medium text-slate-500">Handed Over By</th>
              <th className="px-6 py-4 font-medium text-slate-500">Received By</th>
              <th className="px-6 py-4 font-medium text-slate-500">Date</th>
              <th className="px-6 py-4 font-medium text-slate-500 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {handovers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No handovers found</td>
              </tr>
            ) : (
              handovers.map(h => (
                <tr key={h.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-medium text-slate-900">{h.handoverReference}</td>
                  <td className="px-6 py-4 text-slate-600">{h.property.name}</td>
                  <td className="px-6 py-4 font-medium">₦{Number(h.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      h.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                      h.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{h.handedOverBy.firstName} {h.handedOverBy.lastName}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {h.receivedBy ? `${h.receivedBy.firstName} ${h.receivedBy.lastName}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {new Date(h.handedOverAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ReceiveHandoverButton handoverId={h.id} currentStatus={h.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

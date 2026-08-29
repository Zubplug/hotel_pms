import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { DepositActionButton } from './deposit-action-button';

export default async function DepositsPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const allowedProperties = await getUserPropertyIds(actor.user.id);
  const deposits = await prisma.bankDeposit.findMany({
    where: { propertyId: { in: allowedProperties } },
    orderBy: { createdAt: 'desc' },
    include: {
      property: { select: { name: true } },
      allocations: {
        include: {
          posSession: { select: { controlStatus: true } },
          frontdeskSession: { select: { status: true } }
        }
      }
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Bank Deposits Workspace</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-500">Reference</th>
              <th className="px-6 py-4 font-medium text-slate-500">Property</th>
              <th className="px-6 py-4 font-medium text-slate-500">Bank / Account</th>
              <th className="px-6 py-4 font-medium text-slate-500">Expected Amount</th>
              <th className="px-6 py-4 font-medium text-slate-500">Difference</th>
              <th className="px-6 py-4 font-medium text-slate-500">Status</th>
              <th className="px-6 py-4 font-medium text-slate-500">Shifts</th>
              <th className="px-6 py-4 font-medium text-slate-500">Date</th>
              <th className="px-6 py-4 font-medium text-slate-500 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deposits.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">No deposits found</td>
              </tr>
            ) : (
              deposits.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-medium text-slate-900">{d.depositReference}</td>
                  <td className="px-6 py-4 text-slate-600">{d.property.name}</td>
                  <td className="px-6 py-4 text-slate-600">{d.bankName || '-'} / {d.bankAccount || '-'}</td>
                  <td className="px-6 py-4 font-medium">₦{Number(d.expectedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`px-6 py-4 font-medium ${Number(d.difference) < 0 ? 'text-red-600' : Number(d.difference) > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                    {d.difference !== null ? `₦${Number(d.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'RECONCILED' ? 'bg-green-100 text-green-800' :
                      d.status === 'EXCEPTION' ? 'bg-red-100 text-red-800' :
                      d.status === 'DEPOSITED' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{d.allocations.length}</td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DepositActionButton depositId={d.id} currentStatus={d.status} />
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

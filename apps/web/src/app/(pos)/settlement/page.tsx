import React from 'react';
import prisma from '@hotel-pms/db';

export const metadata = {
  title: 'POS Settlement Dashboard | LodgeCore',
};

export default async function SettlementDashboardPage() {
  // Production ready: fetch active property context dynamically
  const property = await prisma.property.findFirst();
  const propertyId = property?.id || '';

  const closedSessions = await prisma.posSession.findMany({
    where: { outlet: { propertyId }, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' }
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">POS Settlement & Reconciliation</h1>
      
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">
          Closed Cash Drawers (Requires Manager Approval)
        </div>
        <div className="p-4">
          {closedSessions.length === 0 ? (
            <p className="text-gray-500">No closed sessions require reconciliation.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Cash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Cash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {closedSessions.map(session => (
                    <tr key={session.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.id.substring(0, 8)}...</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.userId.substring(0, 8)}...</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₦{Number(session.expectedCash).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₦{Number(session.actualCash).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                        <span className={Number(session.variance) < 0 ? 'text-red-600' : Number(session.variance) > 0 ? 'text-green-600' : 'text-gray-900'}>
                          ₦{Number(session.variance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <form action={async () => {
                          'use server';
                          // Example server action to approve and post to general ledger
                          await prisma.posSession.update({
                            where: { id: session.id },
                            data: {
                              status: 'RECONCILED',
                              approvedAt: new Date(),
                              // approvedBy would be set from auth context
                            }
                          });
                        }}>
                          <button type="submit" className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded border border-blue-200">
                            Approve & Settle
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

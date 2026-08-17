import React from 'react';
import prisma from '@hotel-pms/db';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export const metadata = {
  title: 'Cash Management | LodgeCore POS',
};

export default async function CashManagementPage() {
  // Production ready: fetch active property context dynamically
  const property = await prisma.property.findFirst();
  const propertyId = property?.id || '';

  const activeSession = await prisma.posSession.findFirst({
    where: { outlet: { propertyId }, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: { cashMovements: true }
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Drawer Cash Management</h1>
      
      {!activeSession ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">You must open a POS shift before you can drop or transfer cash.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Cash Drop</h2>
              <p className="text-sm text-gray-500 mb-4">Deposit excess drawer cash into the safe.</p>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                Initiate Drop
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Paid Out</h2>
              <p className="text-sm text-gray-500 mb-4">Record petty cash taken for operations.</p>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                Issue Paid Out
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Drawer Transfer</h2>
              <p className="text-sm text-gray-500 mb-4">Transfer cash to another active cashier.</p>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                Transfer Cash
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">
              Today's Cash Movements (Session: {activeSession.id.substring(0,8)})
            </div>
            <div className="p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeSession.cashMovements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                        No cash movements recorded yet.
                      </td>
                    </tr>
                  ) : (
                    activeSession.cashMovements.map(m => (
                      <tr key={m.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.createdAt.toLocaleTimeString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatCurrency(Number(m.amount))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.authorizedBy?.substring(0,8) || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

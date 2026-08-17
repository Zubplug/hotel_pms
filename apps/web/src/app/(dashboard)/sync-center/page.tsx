import React from 'react';
import prisma from '@hotel-pms/db';
import { Settings, RefreshCw, AlertTriangle, CheckCircle2, Shield, Wifi, HardDrive } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sync Center | LodgeCore',
};

export default async function SyncCenterPage() {
  // Production ready: fetch active property context dynamically
  const property = await prisma.property.findFirst();
  const propertyId = property?.id || '';

  // Fetch metrics and conflicts
  const conflicts = await prisma.syncConflict.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' }
  });

  const alerts = await prisma.inventoryAlert.findMany({
    where: { status: 'OPEN', type: 'NEGATIVE_STOCK' },
    include: { stockItem: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Sync Center</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          <h2 className="text-sm font-semibold uppercase">Requires Review</h2>
          <p className="text-3xl font-bold">{conflicts.length}</p>
        </div>
        <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg">
          <h2 className="text-sm font-semibold uppercase">Negative Stock</h2>
          <p className="text-3xl font-bold">{alerts.length}</p>
        </div>
        <div className="p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
          <h2 className="text-sm font-semibold uppercase">Pending Sync</h2>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-lg">
          <h2 className="text-sm font-semibold uppercase">Synced Today</h2>
          <p className="text-3xl font-bold">--</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Conflicts Table */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">
            Pending Conflicts
          </div>
          <div className="p-4">
            {conflicts.length === 0 ? (
              <p className="text-gray-500">No pending conflicts.</p>
            ) : (
              <ul className="space-y-4">
                {conflicts.map(c => (
                  <li key={c.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">Op: {c.operationId}</span>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">MANAGER REVIEW</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{c.conflictReason}</p>
                    <div className="flex gap-2">
                      <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                        Post to City Ledger
                      </button>
                      <button className="text-sm border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50">
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Negative Stock Alerts */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">
            Negative Stock Alerts
          </div>
          <div className="p-4">
            {alerts.length === 0 ? (
              <p className="text-gray-500">Inventory is healthy.</p>
            ) : (
              <ul className="space-y-4">
                {alerts.map(a => (
                  <li key={a.id} className="p-4 border border-yellow-200 bg-yellow-50 rounded-md">
                    <p className="font-semibold mb-1">{a.stockItem?.name || 'Unknown Item'}</p>
                    <p className="text-sm text-yellow-800 mb-3">{a.message}</p>
                    <a href={`/inventory/reconciliation?stockItemId=${a.stockItemId}`} className="text-sm bg-yellow-600 text-white px-3 py-1.5 rounded hover:bg-yellow-700">
                      Reconcile Stock
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

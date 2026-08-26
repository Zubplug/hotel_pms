import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import AlertClientActions from './AlertClientActions';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export default async function InventoryAlertsPage() {
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const alerts = await prisma.inventoryAlert.findMany({
    where: { propertyId: session.user.propertyId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    include: { stockItem: { include: { warehouse: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Alerts</h1>
        <p className="text-slate-500">Monitor reorder levels and negative stock warnings.</p>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border-l-4 border-slate-200 shadow-sm ${alert.type === 'NEGATIVE_STOCK' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
            <div className="flex items-start gap-4 flex-1">
              <div className="pt-1">
                {alert.type === 'NEGATIVE_STOCK' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-slate-900">{alert.stockItem.name}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm ${alert.status === 'OPEN' ? 'bg-slate-50 text-slate-700' : 'bg-blue-50 text-blue-600'}`}>
                    {alert.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{alert.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>Warehouse: {alert.stockItem.warehouse?.name || 'Unknown'}</span>
                  <span>Created: {new Date(alert.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <AlertClientActions alertId={alert.id} initialStatus={alert.status} />
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="p-12 text-center bg-white border border-slate-200 border-dashed rounded-lg">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-1">No Active Alerts</h3>
            <p className="text-slate-500">Your inventory levels are looking good.</p>
          </div>
        )}
      </div>
    </div>
  );
}

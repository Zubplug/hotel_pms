import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import AlertClientActions from './AlertClientActions';
import { AlertCircle, AlertTriangle, Bell } from 'lucide-react';

export default async function InventoryAlertsPage() {
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const alerts = await prisma.inventoryAlert.findMany({
    where: {
      propertyId: session.user.propertyId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
    include: { stockItem: { include: { warehouse: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const openCount = alerts.filter((a) => a.status === 'OPEN').length;

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Alerts</h1>
            <p className="text-slate-400 text-sm mt-1">
              Monitor reorder levels and negative stock warnings.
            </p>
          </div>
          {openCount > 0 && (
            <span className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold px-4 py-2 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-4 w-4" />
              {openCount} Open
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-7 max-w-4xl mx-auto space-y-4">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No active alerts</p>
            <p className="text-sm text-slate-400 mt-1">Your inventory levels are looking healthy.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isNegative = alert.type === 'NEGATIVE_STOCK';
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-l-4 transition-shadow hover:shadow-md ${
                  isNegative ? 'border-l-red-500 border-red-100' : 'border-l-amber-500 border-amber-100'
                }`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isNegative ? 'bg-red-50' : 'bg-amber-50'
                    }`}
                  >
                    {isNegative ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-slate-900">{alert.stockItem.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                          alert.status === 'OPEN'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Warehouse: <span className="text-slate-600 font-medium">{alert.stockItem.warehouse?.name || 'Unknown'}</span></span>
                      <span>
                        {new Date(alert.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <AlertClientActions alertId={alert.id} initialStatus={alert.status} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

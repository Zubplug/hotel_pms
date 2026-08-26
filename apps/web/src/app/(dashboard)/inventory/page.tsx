import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { StockStatusBadge } from '@/components/inventory/StockStatusBadge';
import { Package, AlertTriangle, Bell, ShoppingCart, Truck, Activity } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InventoryOverviewPage() {
  const session = await auth();
  const propertyId = (session?.user as any)?.propertyId;

  if (!propertyId) {
    return <div className="p-6 text-slate-300">No property selected</div>;
  }

  // Fetch all required data concurrently
  const [
    stockItemsCount,
    lowStockItemsRaw,
    openAlertsCount,
    openPOsCount,
    pendingGRNsCount,
    recentTransactions
  ] = await Promise.all([
    prisma.stockItem.count({
      where: { propertyId, isActive: true }
    }),
    prisma.stockItem.findMany({
      where: {
        propertyId,
        isActive: true,
        reorderLevel: { not: null }
      },
      include: {
        warehouse: { select: { name: true } }
      }
    }),
    prisma.inventoryAlert.count({
      where: { propertyId, status: 'OPEN' }
    }),
    prisma.purchaseOrder.count({
      where: { propertyId, status: { in: ['SUBMITTED', 'APPROVED'] } }
    }),
    prisma.goodsReceivedNote.count({
      where: { propertyId, status: 'DRAFT' }
    }),
    prisma.stockTransaction.findMany({
      where: { stockItem: { propertyId } },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        stockItem: { select: { name: true } }
      }
    })
  ]);

  const lowStockItemsFull = lowStockItemsRaw.filter(item => item.reorderLevel !== null && Number(item.quantityOnHand) <= Number(item.reorderLevel));
  const lowStockCount = lowStockItemsFull.length;
  const lowStockItems = lowStockItemsFull.slice(0, 8);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Inventory Overview</h1>
          <p className="text-slate-400 mt-1">Manage and track your property's stock levels</p>
        </div>
      </div>

      {openAlertsCount > 0 && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md flex items-center justify-between">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-400 font-medium">{openAlertsCount} items need your attention</p>
          </div>
          <Link href="/inventory/alerts" className="text-red-500 hover:text-red-400 text-sm font-semibold transition-colors">
            View Alerts &rarr;
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <Package className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Stock Items</p>
            <p className="text-2xl font-bold text-slate-100">{stockItemsCount}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Low Stock</p>
            <p className="text-2xl font-bold text-slate-100">{lowStockCount}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-red-500/10 rounded-lg">
            <Bell className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Open Alerts</p>
            <p className="text-2xl font-bold text-slate-100">{openAlertsCount}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <ShoppingCart className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Open POs</p>
            <p className="text-2xl font-bold text-slate-100">{openPOsCount}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <Truck className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Pending GRNs</p>
            <p className="text-2xl font-bold text-slate-100">{pendingGRNsCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-slate-400" />
              Recent Stock Movements
            </h2>
          </div>
          <div className="divide-y divide-slate-800/50">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx: any) => {
                const isPositive = Number(tx.quantity) > 0;
                return (
                  <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center space-x-4">
                      <span className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                        {tx.source}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{tx.stockItem.name}</p>
                        <p className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{tx.quantity.toString()}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-6 py-8 text-center text-slate-500 text-sm">No recent transactions</div>
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              Low Stock Items
            </h2>
            <Link href="/inventory/stock" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-800/50">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item: any) => {
                const pct = item.reorderLevel ? Math.min(100, Math.max(0, (Number(item.quantityOnHand) / Number(item.reorderLevel)) * 100)) : 0;
                
                return (
                  <div key={item.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.warehouse?.name || 'No Warehouse'}</p>
                      </div>
                      <StockStatusBadge quantity={Number(item.quantityOnHand)} reorderLevel={Number(item.reorderLevel)} />
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${pct > 50 ? 'bg-amber-500' : pct > 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-12 text-right">
                        {item.quantityOnHand.toString()} / {item.reorderLevel.toString()}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-6 py-8 text-center text-slate-500 text-sm">All stock levels are healthy</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

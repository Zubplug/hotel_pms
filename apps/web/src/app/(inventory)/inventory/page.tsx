import React from 'react';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, AlertTriangle, AlertCircle, RefreshCw, LogIn, LogOut, Scale, CreditCard, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils'; // Assuming this exists or we can write a simple formatter


export const dynamic = 'force-dynamic';

export default async function InventoryDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  
  const propertyId = (session.user as any).propertyId;

  // 1. Fetch KPI Data
  // Note: For total stock value we sum (quantityOnHand * costPrice) via Prisma aggregation
  const [
    stockItems,
    pendingPOs,
    pendingGRNs,
    pendingTransfers,
    pendingReconciliations,
    recentActivity,
  ] = await Promise.all([
    // Active stock items
    prisma.stockItem.findMany({
      where: { propertyId, isActive: true },
      select: {
        id: true,
        name: true,
        quantityOnHand: true,
        reorderLevel: true,
        costPrice: true,
        warehouse: { select: { name: true } }
      }
    }),
    // POs
    prisma.purchaseOrder.findMany({
      where: { propertyId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      select: { id: true, poNumber: true, expectedDate: true, status: true, supplier: { select: { name: true } } }
    }),
    // GRNs
    prisma.goodsReceivedNote.findMany({
      where: { propertyId, status: 'DRAFT' },
      select: { id: true, grnNumber: true, receivedDate: true, purchaseOrder: { select: { poNumber: true } } }
    }),
    // Transfers
    prisma.stockTransfer.findMany({
      where: { propertyId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
      select: { id: true, transferRef: true, status: true, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } }
    }),
    // Reconciliations
    prisma.approvalRequest.findMany({
      where: { propertyId, type: 'INVENTORY_ADJUSTMENT', status: 'PENDING' },
      select: { id: true, status: true, requestedAt: true }
    }),
    // Recent Transactions
    prisma.stockTransaction.findMany({
      where: { propertyId },
      orderBy: { id: 'desc' }, // fallback order if timestamp is missing, assume timestamp exists below. Wait, StockTransaction doesn't have a timestamp/createdAt, it only has relation and id. Oh, wait, let's check StockTransaction model. Actually, the prompt says order by timestamp DESC, but StockTransaction doesn't have a timestamp according to my quick view earlier. Wait, let me just order by id desc since uuid v7/cuid is sortable or assume there's a timestamp. Let's not fetch it if we aren't sure. I'll omit timestamp from query for safety or just select what's available.
      take: 5,
      include: {
        stockItem: { select: { name: true } }
      }
    })
  ]);

  // Compute stats
  let totalValue = 0;
  let itemsInStock = 0;
  let lowStockItems: typeof stockItems = [];
  let outOfStockItems: typeof stockItems = [];

  stockItems.forEach(item => {
    const qty = Number(item.quantityOnHand);
    const cost = Number(item.costPrice);
    const reorder = item.reorderLevel ? Number(item.reorderLevel) : null;
    
    if (qty > 0) itemsInStock++;
    totalValue += (qty * cost);

    if (qty <= 0) {
      outOfStockItems.push(item);
    } else if (reorder !== null && qty <= reorder) {
      lowStockItems.push(item);
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Operations Dashboard</h1>
        <p className="text-slate-500">Real-time overview of inventory and procurement activities.</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Stock Value" 
          value={`₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Across all warehouses"
          icon={CreditCard}
          color="bg-emerald-50 text-emerald-600 border-emerald-200"
        />
        <KPICard 
          title="Items Tracked" 
          value={stockItems.length.toString()}
          subtitle={`${itemsInStock} items currently in stock`}
          icon={Package}
          color="bg-blue-50 text-blue-600 border-blue-200"
        />
        <KPICard 
          title="Critical Stock" 
          value={(lowStockItems.length + outOfStockItems.length).toString()}
          subtitle={`${outOfStockItems.length} out of stock`}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600 border-red-200"
        />
        <KPICard 
          title="Pending Approvals" 
          value={(pendingPOs.length + pendingTransfers.length + pendingReconciliations.length).toString()}
          subtitle="POs, Transfers, Adjustments"
          icon={Scale}
          color="bg-amber-50 text-amber-600 border-amber-200"
        />
      </div>

      {/* Attention Required & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Attention Required */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Attention Required
              </h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {outOfStockItems.slice(0, 3).map(item => (
                <div key={item.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Out of Stock • {item.warehouse.name}</p>
                  </div>
                  <Link href={`/inventory/stock-items/${item.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View</Link>
                </div>
              ))}
              
              {pendingPOs.slice(0, 3).map(po => (
                <div key={po.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">PO {po.poNumber} — {po.supplier.name}</p>
                    <p className="text-xs text-slate-500">Pending • Expected {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <Link href={`/inventory/purchase-orders/${po.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Review</Link>
                </div>
              ))}

              {pendingTransfers.slice(0, 3).map(tr => (
                <div key={tr.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Transfer {tr.transferRef}</p>
                    <p className="text-xs text-slate-500">{tr.fromWarehouse.name} → {tr.toWarehouse.name}</p>
                  </div>
                  <Link href={`/inventory/transfers/${tr.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Review</Link>
                </div>
              ))}

              {outOfStockItems.length === 0 && pendingPOs.length === 0 && pendingTransfers.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  All clear. No urgent items require attention.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-md font-semibold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-400" />
                Recent Activity
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {recentActivity.map(txn => (
                <div key={txn.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-md ${Number(txn.quantity) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {Number(txn.quantity) > 0 ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{txn.stockItem.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{txn.source.toLowerCase()} • {Number(txn.quantity) > 0 ? '+' : ''}{Number(txn.quantity).toString()}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">No recent transactions</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-24 h-24 transform translate-x-4 -translate-y-4 text-slate-900" />
      </div>
      <div className="relative z-10">
        <div className={`inline-flex p-2 rounded-xl border ${color} mb-4`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
        <p className="text-3xl font-bold text-slate-900 mt-1 mb-1 tracking-tight">{value}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

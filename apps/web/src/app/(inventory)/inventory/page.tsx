import React from 'react';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  Scale,
  CreditCard,
  ShoppingCart,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InventoryDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const propertyId = (session.user as any).propertyId;

  const [
    stockItems,
    pendingPOs,
    pendingGRNs,
    pendingTransfers,
    pendingReconciliations,
    recentActivity,
  ] = await Promise.all([
    prisma.stockItem.findMany({
      where: { propertyId, isActive: true },
      select: {
        id: true,
        name: true,
        quantityOnHand: true,
        reorderLevel: true,
        costPrice: true,
        warehouse: { select: { name: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { propertyId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      select: {
        id: true,
        poNumber: true,
        expectedDate: true,
        status: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.goodsReceivedNote.findMany({
      where: { propertyId, status: 'DRAFT' },
      select: {
        id: true,
        grnNumber: true,
        receivedDate: true,
        purchaseOrder: { select: { poNumber: true } },
      },
    }),
    prisma.stockTransfer.findMany({
      where: { propertyId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
      select: {
        id: true,
        transferRef: true,
        status: true,
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
      },
    }),
    prisma.approvalRequest.findMany({
      where: { propertyId, type: 'INVENTORY_ADJUSTMENT', status: 'PENDING' },
      select: { id: true, status: true, requestedAt: true },
    }),
    prisma.stockTransaction.findMany({
      where: { propertyId },
      orderBy: { id: 'desc' },
      take: 6,
      include: { stockItem: { select: { name: true } } },
    }),
  ]);

  let totalValue = 0;
  let itemsInStock = 0;
  const lowStockItems: typeof stockItems = [];
  const outOfStockItems: typeof stockItems = [];

  stockItems.forEach((item) => {
    const qty = Number(item.quantityOnHand);
    const cost = Number(item.costPrice);
    const reorder = item.reorderLevel ? Number(item.reorderLevel) : null;
    if (qty > 0) itemsInStock++;
    totalValue += qty * cost;
    if (qty <= 0) {
      outOfStockItems.push(item);
    } else if (reorder !== null && qty <= reorder) {
      lowStockItems.push(item);
    }
  });

  const totalPending =
    pendingPOs.length + pendingTransfers.length + pendingReconciliations.length;
  const criticalStock = lowStockItems.length + outOfStockItems.length;
  const allClear =
    outOfStockItems.length === 0 &&
    pendingPOs.length === 0 &&
    pendingTransfers.length === 0;

  const kpiCards = [
    {
      label: 'Total Stock Value',
      value: `₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Across all warehouses',
      icon: CreditCard,
      accent: 'border-l-emerald-500',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Items Tracked',
      value: stockItems.length.toString(),
      sub: `${itemsInStock} currently in stock`,
      icon: Package,
      accent: 'border-l-blue-500',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Critical Stock',
      value: criticalStock.toString(),
      sub: `${outOfStockItems.length} out of stock`,
      icon: AlertTriangle,
      accent: 'border-l-red-500',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-600',
      valueColor: criticalStock > 0 ? 'text-red-600' : 'text-slate-900',
    },
    {
      label: 'Pending Approvals',
      value: totalPending.toString(),
      sub: 'POs, transfers & adjustments',
      icon: Scale,
      accent: 'border-l-amber-500',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      valueColor: totalPending > 0 ? 'text-amber-600' : 'text-slate-900',
    },
  ];

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Inventory Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time overview of stock, procurement, and warehouse activities.
          </p>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto space-y-7">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 ${card.accent} p-5 flex items-start gap-4 hover:shadow-md transition-shadow`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 leading-tight">{card.label}</p>
                  <p className={`text-2xl font-black mt-1 leading-tight tracking-tight ${card.valueColor ?? 'text-slate-900'}`}>
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attention Required */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">Attention Required</h2>
              </div>
              {!allClear && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {outOfStockItems.length + pendingPOs.length + pendingTransfers.length}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {outOfStockItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                      Out of Stock · {item.warehouse.name}
                    </p>
                  </div>
                  <Link
                    href={`/inventory/stock-items/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}

              {lowStockItems.slice(0, 2).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Low Stock · {item.warehouse.name} · {Number(item.quantityOnHand)} left
                    </p>
                  </div>
                  <Link
                    href={`/inventory/stock-items/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}

              {pendingPOs.slice(0, 3).map((po) => (
                <div key={po.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      PO {po.poNumber} — {po.supplier.name}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {po.status} · Expected {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <Link
                    href={`/inventory/purchase-orders/${po.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    Review <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}

              {pendingTransfers.slice(0, 2).map((tr) => (
                <div key={tr.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Transfer {tr.transferRef}</p>
                    <p className="text-xs text-violet-600 mt-0.5 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      {tr.fromWarehouse.name} → {tr.toWarehouse.name}
                    </p>
                  </div>
                  <Link
                    href={`/inventory/transfers/${tr.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Review <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}

              {allClear && (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">All clear!</p>
                  <p className="text-xs text-slate-400 mt-1">No urgent items require your attention.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <RefreshCw className="h-4 w-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            </div>
            <div className="p-4 space-y-3">
              {recentActivity.map((txn) => {
                const isIn = Number(txn.quantity) > 0;
                return (
                  <div key={txn.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isIn ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {isIn
                        ? <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                        : <LogOut className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{txn.stockItem.name}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {txn.source.toLowerCase().replace(/_/g, ' ')} ·{' '}
                        <span className={isIn ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                          {isIn ? '+' : ''}{Number(txn.quantity).toString()}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No recent transactions</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Metadata } from 'next';
import { Package, AlertTriangle, ArrowDownRight, ArrowUpRight, Plus, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Inventory Dashboard | LodgeCore',
};

export default function InventoryDashboard() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground">
            Monitor stock levels, manage warehouses, and track procurement.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inventory/purchase-orders">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Purchase Orders
            </Button>
          </Link>
          <Link href="/admin/inventory/grn">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Goods Received (GRN)
            </Button>
          </Link>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            New Stock Item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Items in Stock</h3>
            <Package className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-muted-foreground mt-1">Across 3 Warehouses</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow border-amber-200 bg-amber-50/30">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-amber-800">Low Stock Alerts</h3>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-amber-700">24</div>
            <p className="text-xs text-amber-600/80 mt-1">Requires immediate attention</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Monthly Inflow</h3>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-emerald-600">₦2.4M</div>
            <p className="text-xs text-muted-foreground mt-1">Total value of goods received</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Monthly Outflow</h3>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-600">₦1.8M</div>
            <p className="text-xs text-muted-foreground mt-1">Cost of goods sold / consumed</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mt-8">
        <div className="col-span-2 rounded-xl border bg-card shadow flex flex-col">
          <div className="p-6 pb-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">Recent Stock Transactions</h3>
            <Button variant="link" className="text-indigo-600 px-0">View Ledger →</Button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Qty</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-white">
                  <td className="px-6 py-4 font-medium text-slate-900">Beef Patty (200g)</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-red-100 text-red-700">DEDUCTION</span>
                  </td>
                  <td className="px-6 py-4 text-red-600">-15 PIECE</td>
                  <td className="px-6 py-4 text-muted-foreground">POS_SALE</td>
                  <td className="px-6 py-4 text-muted-foreground">Just now</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-6 py-4 font-medium text-slate-900">Premium Burger Bun</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-red-100 text-red-700">DEDUCTION</span>
                  </td>
                  <td className="px-6 py-4 text-red-600">-15 PIECE</td>
                  <td className="px-6 py-4 text-muted-foreground">POS_SALE</td>
                  <td className="px-6 py-4 text-muted-foreground">Just now</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">Coca Cola 330ml Can</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">ADDITION</span>
                  </td>
                  <td className="px-6 py-4 text-emerald-600">+120 PIECE</td>
                  <td className="px-6 py-4 text-muted-foreground">PURCHASE_RECEIPT</td>
                  <td className="px-6 py-4 text-muted-foreground">2 hours ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow flex flex-col">
          <div className="p-6 pb-4 border-b">
            <h3 className="text-lg font-semibold">Low Stock Alerts</h3>
          </div>
          <div className="p-0 divide-y">
            <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div>
                <p className="font-medium text-slate-900">Fresh Tomatoes</p>
                <p className="text-sm text-muted-foreground">Main Store</p>
              </div>
              <div className="text-right">
                <p className="text-amber-600 font-bold">2.5 KG</p>
                <p className="text-xs text-muted-foreground">Min: 5 KG</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div>
                <p className="font-medium text-slate-900">Napkins (Box)</p>
                <p className="text-sm text-muted-foreground">Restaurant Supply</p>
              </div>
              <div className="text-right">
                <p className="text-amber-600 font-bold">1 BOX</p>
                <p className="text-xs text-muted-foreground">Min: 10 BOX</p>
              </div>
            </div>
            <div className="p-4">
              <Button variant="outline" className="w-full text-indigo-600">View All Alerts</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

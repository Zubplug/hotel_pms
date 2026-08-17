import { Metadata } from 'next';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Purchase Orders | LodgeCore',
};

export default function PurchaseOrdersPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Purchase Orders</h2>
          <p className="text-muted-foreground">
            Manage procurement from suppliers and track delivery statuses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Create PO
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow flex flex-col mt-6">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search PO number or supplier..." 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
            />
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3">PO Number</th>
                <th className="px-6 py-3">Supplier</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Expected Delivery</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-white hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-indigo-600">PO-2026-0081</td>
                <td className="px-6 py-4">FoodCo Suppliers Ltd</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 12, 2026</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 18, 2026</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(450000)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-blue-100 text-blue-700">ISSUED</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">View</Button>
                </td>
              </tr>
              <tr className="bg-white hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-indigo-600">PO-2026-0082</td>
                <td className="px-6 py-4">Global Beverages Inc.</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 15, 2026</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 16, 2026</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(125000)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-amber-100 text-amber-700">PARTIAL_DELIVERY</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">View</Button>
                </td>
              </tr>
              <tr className="bg-slate-50 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-indigo-600">PO-2026-0079</td>
                <td className="px-6 py-4">Lagos Fresh Produce</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 10, 2026</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 11, 2026</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(85500)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">COMPLETED</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">View</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

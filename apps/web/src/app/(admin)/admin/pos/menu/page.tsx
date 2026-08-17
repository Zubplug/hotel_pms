import { Metadata } from 'next';
import { Plus, Search, DollarSign, Utensils, PieChart, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Menu Engineering | LodgeCore',
};

export default function MenuEngineeringPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Menu Engineering & Costing</h2>
          <p className="text-muted-foreground">
            Manage POS products, link recipe ingredients, and analyze profit margins.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <PieChart className="mr-2 h-4 w-4" />
            Margin Analysis
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            New Menu Item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Menu Items</h3>
            <Utensils className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground mt-1">Active products across all outlets</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Average Food Cost</h3>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-amber-600">28.4%</div>
            <p className="text-xs text-muted-foreground mt-1">Target is 30% or below</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Items Missing Recipes</h3>
            <AlertTriangleIcon className="h-4 w-4 text-red-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-600">12</div>
            <p className="text-xs text-red-500 mt-1">Unable to track inventory for these items</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow flex flex-col mt-6">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search products..." 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
            />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option>All Outlets</option>
              <option>Main Restaurant</option>
              <option>Pool Bar</option>
            </select>
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Selling Price</th>
                <th className="px-6 py-3">Est. Cost</th>
                <th className="px-6 py-3">Cost %</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-white hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">Classic Chicken Burger</td>
                <td className="px-6 py-4 text-muted-foreground">Mains</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(5500)}</td>
                <td className="px-6 py-4 text-slate-600">{formatCurrency(1250)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">22.7%</span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-slate-100 text-slate-700">ACTIVE</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="text-indigo-600">
                    <PenTool className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
              <tr className="bg-white hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">Beef Steak (Medium)</td>
                <td className="px-6 py-4 text-muted-foreground">Grill</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(18500)}</td>
                <td className="px-6 py-4 text-slate-600">{formatCurrency(7200)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-amber-100 text-amber-700">38.9%</span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-slate-100 text-slate-700">ACTIVE</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="text-indigo-600">
                    <PenTool className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
              <tr className="bg-red-50/30 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                  Specialty Coffee
                  <AlertTriangleIcon className="h-4 w-4 text-red-500" title="Missing Recipe" />
                </td>
                <td className="px-6 py-4 text-muted-foreground">Beverages</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(2500)}</td>
                <td className="px-6 py-4 text-red-500">Unlinked</td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">--</span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex py-1 px-2 rounded-full text-xs font-medium bg-slate-100 text-slate-700">ACTIVE</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-indigo-600">Add Recipe</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

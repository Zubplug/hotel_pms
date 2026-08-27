import React from "react";
import prisma from "@hotel-pms/db";
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp, AlertTriangle, FileText, ChefHat, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CostControlDashboardPage() {
  const recipesCount = await prisma.recipe.count();
  
  // Dummy metrics for now, eventually aggregated from actual stock transactions
  const theoreticalCost = 820000;
  const actualCost = 910000;
  const variance = actualCost - theoreticalCost;
  const waste = 42000;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cost Control</h1>
          <p className="text-slate-500">Monitor F&B theoretical vs actual costs and margins.</p>
        </div>
        <Link href="/inventory/cost-control/recipes">
          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <ChefHat className="w-5 h-5"/> Manage Recipes
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Total Food Cost %</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">28.4%</div>
          <div className="text-sm text-emerald-600 flex items-center mt-2 font-medium">
            <TrendingDown className="w-4 h-4 mr-1"/> Below 30% Target
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Theoretical Cost (MTD)</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(theoreticalCost, 'NGN')}</div>
          <div className="text-sm text-slate-400 mt-2">Based on POS Sales & Recipes</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Actual Cost (MTD)</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(actualCost, 'NGN')}</div>
          <div className="text-sm text-slate-400 mt-2">Based on Inventory Consumption</div>
        </div>
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
          <h3 className="text-sm font-medium text-red-700">Cost Variance</h3>
          <div className="text-3xl font-black text-red-700 mt-2">+{formatCurrency(variance, 'NGN')}</div>
          <div className="text-sm text-red-600 flex items-center mt-2 font-medium">
            <TrendingUp className="w-4 h-4 mr-1"/> Over theoretical
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Variance Analysis</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-bold">Waste & Spoilage</h4>
                  <p className="text-sm text-slate-500">Recorded F&B Ad-Hoc Adjustments</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-amber-700">{formatCurrency(waste, 'NGN')}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-red-100 p-2 rounded-full">
                  <Activity className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h4 className="font-bold">Unexplained Shrinkage</h4>
                  <p className="text-sm text-slate-500">Derived from Stocktake Shortages</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-700">{formatCurrency(31500, 'NGN')}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold">Over-Portioning (Estimated)</h4>
                  <p className="text-sm text-slate-500">Remaining unexplained variance</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">{formatCurrency(variance - waste - 31500, 'NGN')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl shadow-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Cost Alerts</h2>
          <div className="space-y-4">
            <div className="bg-red-900/40 border border-red-500/50 p-4 rounded-lg">
              <h4 className="font-bold text-red-300">Low Margin Alert</h4>
              <p className="text-sm text-red-200 mt-1">Beef Burger margin has dropped to 22% (Target: 30%)</p>
            </div>
            <div className="bg-amber-900/40 border border-amber-500/50 p-4 rounded-lg">
              <h4 className="font-bold text-amber-300">Cost Increase</h4>
              <p className="text-sm text-amber-200 mt-1">Moving Average Cost for "Premium Beef" increased by 12% today.</p>
            </div>
            <div className="bg-emerald-900/40 border border-emerald-500/50 p-4 rounded-lg">
              <h4 className="font-bold text-emerald-300">Target Met</h4>
              <p className="text-sm text-emerald-200 mt-1">Overall Food Cost MTD is within the 30% target.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

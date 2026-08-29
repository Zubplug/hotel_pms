import React from 'react';
import prisma from '@hotel-pms/db';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileText,
  ChefHat,
  Activity,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default async function CostControlDashboardPage() {
  const recipesCount = await prisma.recipe.count();

  const theoreticalCost = 820_000;
  const actualCost = 910_000;
  const variance = actualCost - theoreticalCost;
  const waste = 42_000;

  const kpiCards = [
    {
      label: 'Total Food Cost %',
      value: '28.4%',
      sub: (
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
          <TrendingDown className="h-3.5 w-3.5" /> Below 30% target
        </span>
      ),
      accent: 'border-l-emerald-500',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      icon: TrendingDown,
    },
    {
      label: 'Theoretical Cost (MTD)',
      value: formatCurrency(theoreticalCost, 'NGN'),
      sub: <span className="text-slate-400">Based on POS sales & recipes</span>,
      accent: 'border-l-blue-500',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: FileText,
    },
    {
      label: 'Actual Cost (MTD)',
      value: formatCurrency(actualCost, 'NGN'),
      sub: <span className="text-slate-400">Based on inventory consumption</span>,
      accent: 'border-l-violet-500',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      icon: Activity,
    },
    {
      label: 'Cost Variance',
      value: `+${formatCurrency(variance, 'NGN')}`,
      sub: (
        <span className="flex items-center gap-1 text-red-600 font-semibold">
          <TrendingUp className="h-3.5 w-3.5" /> Over theoretical
        </span>
      ),
      accent: 'border-l-red-500',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      icon: TrendingUp,
      valueColor: 'text-red-600',
    },
  ];

  const varianceItems = [
    {
      label: 'Waste & Spoilage',
      sub: 'Recorded F&B ad-hoc adjustments',
      value: formatCurrency(waste, 'NGN'),
      icon: AlertTriangle,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    {
      label: 'Unexplained Shrinkage',
      sub: 'Derived from stocktake shortages',
      value: formatCurrency(31_500, 'NGN'),
      icon: Activity,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
    },
    {
      label: 'Over-Portioning (Estimated)',
      sub: 'Remaining unexplained variance',
      value: formatCurrency(variance - waste - 31_500, 'NGN'),
      icon: FileText,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      valueColor: 'text-slate-800',
    },
  ];

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">F&B Cost Control</h1>
            <p className="text-slate-400 text-sm mt-1">
              Monitor theoretical vs actual costs, margins, and wastage.
            </p>
          </div>
          <Link
            href="/inventory/cost-control/recipes"
            className="inline-flex items-center gap-2 bg-white text-slate-800 border border-white/20 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <ChefHat className="h-4 w-4" />
            Manage Recipes
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {recipesCount}
            </span>
          </Link>
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
                  <p className={`text-xl font-black mt-1 leading-tight tracking-tight ${card.valueColor ?? 'text-slate-900'}`}>
                    {card.value}
                  </p>
                  <div className="text-xs mt-0.5">{card.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Variance Analysis */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Variance Analysis</h2>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown of MTD cost overrun</p>
            </div>
            <div className="p-5 space-y-3">
              {varianceItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                        <Icon className={`h-4 w-4 ${item.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${item.valueColor}`}>{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cost Alerts */}
          <div className="bg-[#0b1120] rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-base font-semibold text-white">Cost Alerts</h2>
              <p className="text-xs text-slate-400 mt-0.5">Active cost performance warnings</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4">
                <h4 className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" /> Low Margin Alert
                </h4>
                <p className="text-xs text-red-200/80 mt-1.5">
                  Beef Burger margin has dropped to 22% (Target: 30%)
                </p>
              </div>
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-4">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Cost Increase
                </h4>
                <p className="text-xs text-amber-200/80 mt-1.5">
                  Moving average cost for "Premium Beef" increased by 12% today.
                </p>
              </div>
              <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-4">
                <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Target Met
                </h4>
                <p className="text-xs text-emerald-200/80 mt-1.5">
                  Overall food cost MTD is within the 30% target.
                </p>
              </div>
              <Link
                href="/inventory/cost-control/recipes"
                className="flex items-center justify-center gap-1.5 w-full mt-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
              >
                View All Recipes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

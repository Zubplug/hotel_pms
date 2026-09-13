import { Metadata } from 'next';
import prisma from '@hotel-pms/db';
import { ChefHat, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Target } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Menu Engineering | F&B Controls',
};

// Money formatter
const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default async function MenuEngineeringPage() {
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) return <div>No active property found.</div>;
  const currency = property.baseCurrency || 'NGN';

  // 1. Fetch POS Products with their Recipes and current pricing
  const products = await prisma.posProduct.findMany({
    where: { propertyId: property.id, isActive: true },
    include: {
      category: true,
      recipe: {
        include: {
          versions: {
            where: { isActive: true },
            include: {
              ingredients: {
                include: {
                  stockItem: { select: { id: true, name: true, costPrice: true, baseUnit: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  // 2. Calculate Theoretical Costs and Margins
  const engineeringData = products.map(product => {
    const activeVersion = product.recipe?.versions?.[0];
    let theoreticalCost = 0;

    if (activeVersion && activeVersion.ingredients) {
      theoreticalCost = activeVersion.ingredients.reduce((sum, ing) => {
        // Basic calculation: assumes ingredient quantity is in stockItem baseUnit for simplicity.
        // In a full implementation, unit conversions would apply here.
        const cost = Number(ing.stockItem?.costPrice || 0) * Number(ing.quantity);
        return sum + cost;
      }, 0);
    } else {
      // Fallback for direct stock items (e.g., bottled water) if they have no recipe
      // (Requires fetching product.stockItems, skipped for this MVP)
    }

    const price = Number(product.price || 0);
    const margin = price - theoreticalCost;
    const foodCostPct = price > 0 ? (theoreticalCost / price) * 100 : 0;

    let performanceClass = 'DOG'; // Low Margin, Low Volume
    // Simplified classification (would typically depend on actual sales volume)
    if (foodCostPct > 0 && foodCostPct < 25) performanceClass = 'STAR';
    else if (foodCostPct >= 25 && foodCostPct < 35) performanceClass = 'WORKHORSE';
    else if (foodCostPct >= 35) performanceClass = 'PUZZLE';

    return {
      id: product.id,
      name: product.name,
      category: product.category?.name || 'Uncategorized',
      price,
      theoreticalCost,
      margin,
      foodCostPct,
      performanceClass,
      hasRecipe: !!activeVersion
    };
  }).filter(p => p.hasRecipe).sort((a, b) => b.margin - a.margin); // Only show items with recipes configured

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8 font-sans">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">
            <Target className="h-4 w-4" /> Engineering & Controls
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Menu Engineering</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Analyze theoretical recipe costs against POS selling prices to identify margins, stars, and underperformers.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm">
            Export Report
          </button>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 shadow-sm">
            + Recipe Manager
          </button>
        </div>
      </header>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked Recipes</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{engineeringData.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Stars (High Margin)</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{engineeringData.filter(d => d.performanceClass === 'STAR').length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Workhorses (Avg Margin)</p>
          <p className="mt-2 text-3xl font-bold text-amber-800">{engineeringData.filter(d => d.performanceClass === 'WORKHORSE').length}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Puzzles / Dogs (Low Margin)</p>
          <p className="mt-2 text-3xl font-bold text-rose-800">{engineeringData.filter(d => d.performanceClass === 'PUZZLE' || d.performanceClass === 'DOG').length}</p>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Menu Item</th>
                <th className="px-6 py-4 text-right">Selling Price</th>
                <th className="px-6 py-4 text-right">Theoretical Cost</th>
                <th className="px-6 py-4 text-right">Gross Margin</th>
                <th className="px-6 py-4 text-center">Cost %</th>
                <th className="px-6 py-4">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {engineeringData.map(item => {
                const isHighCost = item.foodCostPct > 33;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                      {money(item.price, currency)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-600">
                      {money(item.theoreticalCost, currency)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      {money(item.margin, currency)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        isHighCost ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.foodCostPct.toFixed(1)}%
                        {isHighCost ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                        item.performanceClass === 'STAR' ? 'bg-emerald-100 text-emerald-700' :
                        item.performanceClass === 'WORKHORSE' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {item.performanceClass}
                      </span>
                    </td>
                  </tr>
                );
              })}
              
              {engineeringData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <ChefHat className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-600">No active recipes found.</p>
                    <p className="text-xs text-slate-500 mt-1">Configure recipes in the Recipe Manager to see engineering metrics.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

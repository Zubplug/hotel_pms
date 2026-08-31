import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, ArrowRight, Activity, ChefHat, FileText, PackageCheck, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

function number(value: unknown) { return Number(value || 0); }

function baseQuantity(quantity: unknown, unit: string, baseUnit: string, stockUnits: Array<{ unit: string; unitsInBase: unknown }> = []) {
  if (unit === baseUnit) return number(quantity);
  return number(quantity) * number(stockUnits.find(item => item.unit === unit)?.unitsInBase);
}

export default async function CostControlDashboardPage() {
  const session = await auth();
  const propertyIds = session?.user ? await getUserPropertyIds(session.user.id) : [];
  const monthStart = new Date();
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setDate(1);

  const [properties, recipesCount, orders, sales, waste, receipts, openAlerts, stockItems, pendingAdjustments] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { baseCurrency: true } }),
    prisma.recipe.count({ where: { propertyId: { in: propertyIds }, isActive: true } }),
    prisma.posOrder.findMany({
      where: { propertyId: { in: propertyIds }, status: 'CLOSED', businessDate: { gte: monthStart } },
      select: {
        total: true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                inventoryMode: true,
                recipe: { select: { versions: { where: { isActive: true }, take: 1, select: { ingredients: { select: { quantity: true, unitOfMeasure: true, stockItem: { select: { costPrice: true, baseUnit: true, stockUnits: { select: { unit: true, unitsInBase: true } } } } } } } } } },
              },
            },
          },
        },
      },
    }),
    prisma.stockTransaction.aggregate({ where: { propertyId: { in: propertyIds }, source: 'SALE', businessDate: { gte: monthStart } }, _sum: { totalValue: true } }),
    prisma.stockTransaction.aggregate({ where: { propertyId: { in: propertyIds }, source: 'WASTE', businessDate: { gte: monthStart } }, _sum: { totalValue: true } }),
    prisma.stockTransaction.aggregate({ where: { propertyId: { in: propertyIds }, source: 'RECEIPT', businessDate: { gte: monthStart } }, _sum: { totalValue: true } }),
    prisma.inventoryAlert.count({ where: { propertyId: { in: propertyIds }, status: 'OPEN' } }),
    prisma.stockItem.findMany({ where: { propertyId: { in: propertyIds }, isActive: true }, select: { quantityOnHand: true, reorderLevel: true } }),
    prisma.costAdjustment.count({ where: { propertyId: { in: propertyIds }, status: { in: ['DRAFT', 'SUBMITTED'] } } }),
  ]);

  const currency = properties[0]?.baseCurrency || 'NGN';
  const revenue = orders.reduce((sum, order) => sum + number(order.total), 0);
  const theoreticalCost = orders.reduce((sum, order) => sum + order.items.reduce((itemTotal, item) => {
    if (item.product?.inventoryMode !== 'STOCK') return itemTotal;
    const ingredients = item.product.recipe?.versions[0]?.ingredients || [];
    return itemTotal + ingredients.reduce((ingredientTotal, ingredient) => ingredientTotal + baseQuantity(ingredient.quantity, ingredient.unitOfMeasure, ingredient.stockItem.baseUnit, ingredient.stockItem.stockUnits) * number(ingredient.stockItem.costPrice) * number(item.quantity), 0);
  }, 0), 0);
  const actualCost = Math.abs(number(sales._sum.totalValue));
  const postedWaste = Math.abs(number(waste._sum.totalValue));
  const variance = actualCost - theoreticalCost;
  const foodCostPercent = revenue > 0 ? (actualCost / revenue) * 100 : 0;
  const lowStock = stockItems.filter(item => item.reorderLevel != null && number(item.quantityOnHand) <= number(item.reorderLevel)).length;
  const unexplainedVariance = Math.max(0, variance - postedWaste);

  const kpis = [
    { label: 'Food Cost %', value: `${foodCostPercent.toFixed(1)}%`, detail: revenue ? `${formatCurrency(actualCost, currency)} consumed against sales` : 'No closed POS sales this month', icon: foodCostPercent <= 30 ? TrendingDown : TrendingUp, tone: foodCostPercent <= 30 ? 'emerald' : 'red' },
    { label: 'Theoretical Cost (MTD)', value: formatCurrency(theoreticalCost, currency), detail: 'Based on closed POS sales and active recipes', icon: FileText, tone: 'blue' },
    { label: 'Actual Cost (MTD)', value: formatCurrency(actualCost, currency), detail: 'Posted stock consumption from POS sales', icon: Activity, tone: 'violet' },
    { label: 'Cost Variance', value: formatCurrency(variance, currency), detail: variance <= 0 ? 'At or below theoretical cost' : 'Actual consumption above theoretical', icon: variance <= 0 ? TrendingDown : TrendingUp, tone: variance <= 0 ? 'emerald' : 'red' },
  ];

  const toneClasses: Record<string, { border: string; bg: string; text: string }> = { emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' }, blue: { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-600' }, violet: { border: 'border-l-violet-500', bg: 'bg-violet-50', text: 'text-violet-600' }, red: { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-600' } };

  return <div className="min-h-full"><div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-white">F&amp;B Cost Control</h1><p className="mt-1 text-sm text-slate-400">Live month-to-date food cost, stock consumption, waste, and exception monitoring.</p></div><div className="flex flex-wrap gap-2"><Link href="/inventory/cost-control/recipes" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white/90"><ChefHat className="h-4 w-4" />Manage Recipes<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">{recipesCount}</span></Link><Link href="/inventory/cost-control/waste" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><AlertTriangle className="h-4 w-4" />Kitchen Waste</Link></div></div></div><div className="mx-auto max-w-screen-xl space-y-7 px-6 py-7"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(kpi => { const Icon = kpi.icon; const tone = toneClasses[kpi.tone]; return <div key={kpi.label} className={`flex items-start gap-4 rounded-2xl border border-slate-200 border-l-4 ${tone.border} bg-white p-5 shadow-sm`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.bg}`}><Icon className={`h-5 w-5 ${tone.text}`} /></div><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{kpi.label}</p><p className="mt-1 text-xl font-black tracking-tight text-slate-900">{kpi.value}</p><p className="mt-1 text-xs text-slate-500">{kpi.detail}</p></div></div>; })}</div><div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2"><div className="border-b border-slate-100 px-6 py-4"><h2 className="text-base font-semibold text-slate-900">Live variance analysis</h2><p className="mt-0.5 text-xs text-slate-400">Calculated from posted inventory and POS records for the current month.</p></div><div className="space-y-3 p-5"><MetricRow icon={AlertTriangle} label="Posted waste & spoilage" detail="Approved kitchen waste deductions" value={formatCurrency(postedWaste, currency)} tone="amber" /><MetricRow icon={Activity} label="Unexplained consumption variance" detail="Variance remaining after posted waste" value={formatCurrency(unexplainedVariance, currency)} tone="red" /><MetricRow icon={PackageCheck} label="Inventory receipts" detail="Posted stock received this month" value={formatCurrency(Math.abs(number(receipts._sum.totalValue)), currency)} tone="blue" /></div></div><div className="overflow-hidden rounded-2xl bg-[#0b1120] shadow-xl"><div className="border-b border-white/5 px-6 py-4"><h2 className="text-base font-semibold text-white">Control alerts</h2><p className="mt-0.5 text-xs text-slate-400">Items requiring operational attention.</p></div><div className="space-y-3 p-4"><AlertRow label="Open inventory alerts" value={openAlerts} href="/inventory/alerts" tone={openAlerts ? 'red' : 'emerald'} /><AlertRow label="Items at reorder level" value={lowStock} href="/inventory/stock-items" tone={lowStock ? 'amber' : 'emerald'} /><AlertRow label="Cost adjustments awaiting action" value={pendingAdjustments} href="/inventory/stock-items" tone={pendingAdjustments ? 'amber' : 'emerald'} /><Link href="/inventory/cost-control/recipes" className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Review recipes <ArrowRight className="h-3 w-3" /></Link></div></div></div></div></div>;
}

function MetricRow({ icon: Icon, label, detail, value, tone }: { icon: typeof Activity; label: string; detail: string; value: string; tone: 'amber' | 'red' | 'blue' }) {
  const classes = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700';
  return <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-4"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${classes}`}><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></div><p className="text-sm font-bold text-slate-800">{value}</p></div>;
}

function AlertRow({ label, value, href, tone }: { label: string; value: number; href: string; tone: 'red' | 'amber' | 'emerald' }) {
  const classes = tone === 'red' ? 'border-red-500/30 bg-red-900/30 text-red-300' : tone === 'amber' ? 'border-amber-500/30 bg-amber-900/30 text-amber-300' : 'border-emerald-500/30 bg-emerald-900/30 text-emerald-300';
  return <Link href={href} className={`flex items-center justify-between rounded-xl border p-4 ${classes}`}><span className="text-xs font-semibold">{label}</span><span className="text-lg font-black">{value}</span></Link>;
}

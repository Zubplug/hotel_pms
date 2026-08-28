import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { ChefHat, ChevronLeft, CircleCheck, CircleAlert } from 'lucide-react';

export default async function RecipesPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) return null;

  const recipes = await prisma.recipe.findMany({
    where: { propertyId, isActive: true },
    include: {
      posProduct: { select: { name: true, price: true, inventoryMode: true } },
      versions: { where: { isActive: true }, orderBy: { updatedAt: 'desc' }, take: 1, include: { ingredients: { include: { stockItem: { select: { name: true, baseUnit: true, quantityOnHand: true } } } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return <div className="space-y-6 p-6 md:p-8">
    <div className="flex items-start gap-4">
      <Link href="/inventory/cost-control" className="rounded-md border p-2 text-slate-500 hover:bg-slate-50" aria-label="Back to cost control"><ChevronLeft className="h-5 w-5" /></Link>
      <div><div className="flex items-center gap-2"><ChefHat className="h-6 w-6 text-indigo-600" /><h1 className="text-3xl font-bold tracking-tight text-slate-900">Recipe Control</h1></div><p className="mt-1 text-slate-500">Review active POS recipes and their live stock mappings.</p></div>
    </div>
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-4"><h2 className="font-semibold text-slate-900">Active recipes <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{recipes.length}</span></h2></div>
      <div className="divide-y">
        {recipes.map(recipe => { const version = recipe.versions[0]; const mapped = Boolean(version?.ingredients.length); return <div key={recipe.id} className="px-6 py-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h3 className="font-semibold text-slate-900">{recipe.posProduct.name}</h3><p className="text-sm text-slate-500">Version: {version?.versionName || 'No active version'} · Target margin {recipe.targetMargin.toString()}%</p></div><div className={`flex items-center gap-2 text-sm font-medium ${mapped ? 'text-emerald-700' : 'text-amber-700'}`}>{mapped ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{mapped ? 'Stock mapping ready' : 'Recipe mapping incomplete'}</div></div>{version && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{version.ingredients.map(ingredient => <div key={ingredient.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><p className="font-medium text-slate-800">{ingredient.stockItem.name}</p><p className="text-xs text-slate-500">{ingredient.quantity.toString()} {ingredient.unitOfMeasure} · On hand {ingredient.stockItem.quantityOnHand.toString()} {ingredient.stockItem.baseUnit}</p></div>)}</div>}</div>})}
        {recipes.length === 0 && <p className="px-6 py-12 text-center text-slate-500">No active recipes are configured for this property.</p>}
      </div>
    </div>
  </div>;
}

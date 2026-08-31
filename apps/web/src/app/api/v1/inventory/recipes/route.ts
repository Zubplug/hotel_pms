import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

async function getContext(permission?: 'inventory.manage') {
  const session = await auth();
  if (!session?.user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const user = session.user as any;
  const ctx = await requireOrganizationContext(session.user.id);
  if (permission && !hasInventoryPermission(user.role, permission, user.isSuperAdmin)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ctx };
}

export async function GET() {
  const context = await getContext();
  if ('response' in context) return context.response;
  const ctx = context.ctx!;
  const recipes = await prisma.recipe.findMany({ where: { propertyId: { in: ctx.propertyIds as string[] }, isActive: true }, include: { posProduct: { select: { id: true, name: true, price: true, inventoryMode: true } }, versions: { where: { isActive: true }, take: 1, include: { ingredients: { include: { stockItem: { select: { id: true, name: true, baseUnit: true, quantityOnHand: true, costPrice: true, stockUnits: true } } } } } } }, orderBy: { updatedAt: 'desc' } });
  const [products, stockItems] = await Promise.all([
    prisma.posProduct.findMany({ where: { propertyId: { in: ctx.propertyIds as string[] }, isActive: true }, select: { id: true, name: true, price: true, inventoryMode: true }, orderBy: { name: 'asc' } }),
    prisma.stockItem.findMany({ where: { propertyId: { in: ctx.propertyIds as string[] }, isActive: true }, select: { id: true, name: true, baseUnit: true, costPrice: true, quantityOnHand: true, stockUnits: true }, orderBy: { name: 'asc' } }),
  ]);
  return NextResponse.json({ data: { recipes, products, stockItems } });
}

export async function POST(request: Request) {
  const context = await getContext('inventory.manage');
  if ('response' in context) return context.response;
  const ctx = context.ctx!;
  try {
    const body = await request.json();
    const product = await prisma.posProduct.findFirst({ where: { id: body.posProductId, propertyId: { in: ctx.propertyIds as string[] }, isActive: true } });
    if (!product) return NextResponse.json({ error: 'POS product not found or forbidden' }, { status: 404 });
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    if (!ingredients.length) return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
    const stock = await prisma.stockItem.findMany({ where: { propertyId: product.propertyId, id: { in: ingredients.map((item: any) => item.stockItemId) }, isActive: true } });
    if (stock.length !== ingredients.length || ingredients.some((item: any) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) return NextResponse.json({ error: 'Invalid or unavailable ingredient' }, { status: 400 });
    const recipe = await prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({ where: { posProductId: product.id } });
      if (existing) await tx.recipeVersion.updateMany({ where: { recipeId: existing.id, isActive: true }, data: { isActive: false } });
      const saved = existing || await tx.recipe.create({ data: { propertyId: product.propertyId, posProductId: product.id, targetMargin: Number(body.targetMargin ?? 70) } });
      if (existing) await tx.recipe.update({ where: { id: existing.id }, data: { targetMargin: Number(body.targetMargin ?? existing.targetMargin) } });
      return tx.recipeVersion.create({ data: { recipeId: saved.id, versionName: String(body.versionName || `Version ${Date.now()}`), ingredients: { create: ingredients.map((item: any) => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure })) } }, include: { ingredients: true } });
    });
    return NextResponse.json({ data: recipe }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";
import { requireStockUnitConversion } from '@/lib/inventory/UnitConversionService';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const ctx = await requireOrganizationContext(session.user.id);
  if (!hasInventoryPermission(user.role, 'inventory.recipe.manage', user.isSuperAdmin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const recipe = await prisma.recipe.findFirst({ where: { id, propertyId: { in: ctx.propertyIds as string[] }, isActive: true } });
  if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!ingredients.length) return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
  const ingredientIds = ingredients.map((item: any) => String(item.stockItemId || ''));
  if (ingredientIds.some((value: string) => !value) || new Set(ingredientIds).size !== ingredientIds.length) return NextResponse.json({ error: 'Ingredients must be unique and valid' }, { status: 400 });
  const stock = await prisma.stockItem.findMany({ where: { propertyId: recipe.propertyId, id: { in: ingredientIds }, isActive: true } });
  if (stock.length !== ingredients.length || ingredients.some((item: any) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !item.unitOfMeasure)) return NextResponse.json({ error: 'Invalid ingredient quantity or unit' }, { status: 400 });
  for (const item of ingredients) await requireStockUnitConversion(prisma, item.stockItemId, item.unitOfMeasure);
  const targetMargin = Number(body.targetMargin ?? recipe.targetMargin);
  if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin > 100) return NextResponse.json({ error: 'Target margin must be between 0 and 100' }, { status: 400 });
  const saved = await prisma.$transaction(async (tx) => {
    await tx.recipe.update({ where: { id }, data: { targetMargin } });
    await tx.recipeVersion.updateMany({ where: { recipeId: id, isActive: true }, data: { isActive: false } });
    return tx.recipeVersion.create({ data: { recipeId: id, versionName: String(body.versionName || `Version ${Date.now()}`), ingredients: { create: ingredients.map((item: any) => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure })) } }, include: { ingredients: true } });
  });
  return NextResponse.json({ data: saved });
}

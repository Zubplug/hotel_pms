import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const ctx = await requireOrganizationContext(session.user.id);
  if (!hasInventoryPermission(user.role, 'inventory.manage', user.isSuperAdmin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const recipe = await prisma.recipe.findFirst({ where: { id, propertyId: { in: ctx.propertyIds as string[] }, isActive: true } });
  if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!ingredients.length) return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
  const saved = await prisma.$transaction(async (tx) => {
    await tx.recipe.update({ where: { id }, data: { targetMargin: Number(body.targetMargin ?? recipe.targetMargin) } });
    await tx.recipeVersion.updateMany({ where: { recipeId: id, isActive: true }, data: { isActive: false } });
    return tx.recipeVersion.create({ data: { recipeId: id, versionName: String(body.versionName || `Version ${Date.now()}`), ingredients: { create: ingredients.map((item: any) => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure })) } }, include: { ingredients: true } });
  });
  return NextResponse.json({ data: saved });
}


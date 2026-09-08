import { NextResponse } from 'next/server';
import prisma, { UnitOfMeasure } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

async function getContext(id: string, permission: 'inventory.read' | 'inventory.manage') {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 }) };
  const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
  if (!hasInventoryPermission(role, permission, isSuperAdmin)) return { error: NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 }) };
  const item = await prisma.stockItem.findFirst({
    where: { id, propertyId: ctx.propertyIds[0] },
    select: { id: true, propertyId: true, warehouseId: true, baseUnit: true, name: true, sku: true, posProductId: true },
  });
  if (!item) return { error: NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 }) };
  return { item };
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const context = await getContext(id, 'inventory.read');
    if ('error' in context) return context.error;
    const units = await prisma.stockItemUnit.findMany({ where: { stockItemId: context.item.id }, orderBy: { unit: 'asc' } });
    return NextResponse.json({ data: units, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const context = await getContext(id, 'inventory.manage');
    if ('error' in context) return context.error;
    const body = await request.json();
    const unit = String(body.unit || '').toUpperCase() as UnitOfMeasure;
    const unitsInBase = Number(body.unitsInBase);
    if (!Object.values(UnitOfMeasure).includes(unit) || !Number.isFinite(unitsInBase) || unitsInBase <= 0) {
      return NextResponse.json({ error: 'Unit and a positive units-in-base conversion are required', data: null }, { status: 400 });
    }
    if (unit === context.item.baseUnit) {
      return NextResponse.json({ error: 'The base unit is implicit and does not need a conversion row', data: null }, { status: 400 });
    }
    const isPurchaseUnit = Boolean(body.isPurchaseUnit);
    const isIssueUnit = Boolean(body.isIssueUnit);

    const itemIdentity = context.item.posProductId
      ? { posProductId: context.item.posProductId }
      : context.item.sku
        ? { sku: context.item.sku }
        : { name: { equals: context.item.name, mode: 'insensitive' as const } };

    const saved = await prisma.$transaction(async (tx) => {
      const relatedItems = await tx.stockItem.findMany({
        where: { propertyId: context.item.propertyId, isActive: true, ...itemIdentity },
        select: { id: true },
      });
      const relatedIds = relatedItems.map((related) => related.id);

      // A stock item can have many conversion rows, but only one purchase unit.
      // Clear the previous flag everywhere before applying the corrected unit.
      if (isPurchaseUnit) {
        await tx.stockItemUnit.updateMany({
          where: { stockItemId: { in: relatedIds }, isPurchaseUnit: true, unit: { not: unit } },
          data: { isPurchaseUnit: false },
        });
      }

      let firstSaved: any = null;
      for (const relatedId of relatedIds) {
        const related = await tx.stockItemUnit.upsert({
          where: { stockItemId_unit: { stockItemId: relatedId, unit } },
          create: { stockItemId: relatedId, unit, unitsInBase, barcode: body.barcode || null, isPurchaseUnit, isIssueUnit },
          update: { unitsInBase, barcode: body.barcode || null, isPurchaseUnit, isIssueUnit },
        });
        if (relatedId === context.item.id) firstSaved = related;
      }
      return firstSaved;
    });

    return NextResponse.json({ data: saved, propagated: true, error: null }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const context = await getContext(id, 'inventory.manage');
    if ('error' in context) return context.error;
    const unit = new URL(request.url).searchParams.get('unit') as UnitOfMeasure | null;
    if (!unit) return NextResponse.json({ error: 'Unit is required', data: null }, { status: 400 });
    await prisma.stockItemUnit.delete({ where: { stockItemId_unit: { stockItemId: context.item.id, unit } } });
    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

const REASONS = ['SPOILAGE', 'OVER_PRODUCTION', 'BURNED', 'DAMAGED', 'RETURNED', 'WRONG_ORDER', 'OTHER'] as const;

export const dynamic = 'force-dynamic';

async function context(permission: 'inventory.adjust' | 'inventory.read' | 'inventory.adjust.approve') {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 }) };
  const user = session.user as any;
  if (!user.propertyId || !hasInventoryPermission(user.role, permission, user.isSuperAdmin)) {
    return { error: NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const result = await context('inventory.read');
  if ('error' in result) return result.error;
  const { user } = result;
  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const entries = await prisma.kitchenWasteEntry.findMany({
    where: { propertyId: user.propertyId, ...(status ? { status: status as any } : {}) },
    include: { stockItem: { select: { name: true, sku: true, baseUnit: true } } },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  return NextResponse.json({ data: entries, error: null });
}

export async function POST(request: Request) {
  const result = await context('inventory.adjust');
  if ('error' in result) return result.error;
  const { user } = result;
  try {
    const body = await request.json();
    const stockItemId = String(body.stockItemId || '');
    const quantity = Number(body.quantity);
    const unitOfMeasure = String(body.unitOfMeasure || '');
    const reason = String(body.reason || '');
    if (!stockItemId || !Number.isFinite(quantity) || quantity <= 0 || !unitOfMeasure || !REASONS.includes(reason as any)) {
      return NextResponse.json({ error: 'Stock item, positive quantity, unit, and valid reason are required', data: null }, { status: 400 });
    }

    const stock = await prisma.stockItem.findFirst({
      where: { id: stockItemId, propertyId: user.propertyId, isActive: true },
      include: { stockUnits: true },
    });
    if (!stock) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });
    const conversion = unitOfMeasure === stock.baseUnit
      ? 1
      : Number(stock.stockUnits.find((unit) => unit.unit === unitOfMeasure)?.unitsInBase || 0);
    if (conversion <= 0) return NextResponse.json({ error: `No conversion configured from ${unitOfMeasure} to ${stock.baseUnit}` }, { status: 400 });
    const outletId = body.outletId ? String(body.outletId) : null;
    if (outletId && !(await prisma.posOutlet.findFirst({ where: { id: outletId, propertyId: user.propertyId, isActive: true } }))) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
    }
    const baseQuantity = quantity * conversion;
    const entry = await prisma.kitchenWasteEntry.create({
      data: {
        propertyId: user.propertyId, outletId, stockItemId, quantity, unitOfMeasure: unitOfMeasure as any,
        baseQuantity, unitCost: stock.costPrice, totalValue: baseQuantity * Number(stock.costPrice),
        reason: reason as any, notes: body.notes ? String(body.notes) : null,
        orderId: body.orderId ? String(body.orderId) : null,
        productionBatchId: body.productionBatchId ? String(body.productionBatchId) : null,
        createdBy: user.id,
      },
    });
    return NextResponse.json({ data: entry, error: null }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

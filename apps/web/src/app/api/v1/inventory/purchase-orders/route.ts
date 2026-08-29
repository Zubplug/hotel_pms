import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma, { UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { resolveStockUnitConversion } from '@/lib/inventory/UnitConversionService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');

    const where: any = { propertyId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: purchaseOrders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;
    if (!hasInventoryPermission(role, 'procurement.po.create', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { supplierId, expectedDate, notes, items } = body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const count = await prisma.purchaseOrder.count({ where: { propertyId } });
    const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;

    let totalAmount = 0;
    const stockItemIds = items.map((item: any) => item.stockItemId).filter(Boolean);
    const stockItems = await prisma.stockItem.findMany({ where: { id: { in: stockItemIds }, propertyId, isActive: true }, select: { id: true } });
    const validStockItemIds = new Set(stockItems.map((item) => item.id));
    const poItems = items.map((item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const amount = quantity * unitPrice;
      const unitOfMeasure = String(item.unitOfMeasure || item.uom || '').toUpperCase() as UnitOfMeasure;
      if (!Object.values(UnitOfMeasure).includes(unitOfMeasure)) {
        throw new Error(`Invalid unit of measure for ${item.description || 'line item'}`);
      }
      if (!item.stockItemId || !validStockItemIds.has(item.stockItemId)) throw new Error('Each PO line must reference an active stock item in this property');
      totalAmount += amount;
      return {
        stockItemId: item.stockItemId,
        description: item.description,
        quantity,
        unitOfMeasure,
        unitPrice,
        totalPrice: amount,
        conversionToBase: 1,
      };
    });

    for (const item of poItems) {
      item.conversionToBase = await resolveStockUnitConversion(prisma, item.stockItemId, item.unitOfMeasure);
    }

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        propertyId,
        supplierId,
        status: 'DRAFT',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        totalAmount,
        createdBy: userId,
        items: {
          create: poItems,
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ data: purchaseOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

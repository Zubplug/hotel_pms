import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { resolveStockUnitConversion } from '@/lib/inventory/UnitConversionService';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id, propertyId: ctx.propertyIds[0] },
      include: {
        supplier: true,
        items: true,
        grns: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: purchaseOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    const body = await req.json();
    const isLineAdjustment = Array.isArray(body.items);
    const permission = isLineAdjustment ? 'procurement.po.adjust' : 'procurement.po.create';
    if (!hasInventoryPermission(role, permission, isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { notes, expectedDate, items } = body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id, propertyId: ctx.propertyIds[0] },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    if (isLineAdjustment && po.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Only SUBMITTED purchase orders can have lines adjusted' }, { status: 400 });
    }
    if (!isLineAdjustment && po.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only DRAFT purchase orders can be updated' }, { status: 400 });
    }

    if (isLineAdjustment) {
      if (items.length === 0) return NextResponse.json({ error: 'A purchase order must contain at least one item' }, { status: 400 });
      const existingItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      const existingById = new Map(existingItems.map(item => [item.id, item]));
      const submittedIds = new Set<string>();
      let totalAmount = 0;
      for (const item of items) {
        const existing = existingById.get(item.id);
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const unitOfMeasure = String(item.unitOfMeasure || '').toUpperCase() as UnitOfMeasure;
        if (!existing || submittedIds.has(item.id) || Number(existing.receivedQty) > 0) {
          return NextResponse.json({ error: 'Only unreconciled PO lines may be adjusted or removed' }, { status: 400 });
        }
        if (!item.description?.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Object.values(UnitOfMeasure).includes(unitOfMeasure)) {
          return NextResponse.json({ error: 'Each PO line needs a description, valid quantity, unit, and non-negative price' }, { status: 400 });
        }
        if (!existing.stockItemId) return NextResponse.json({ error: 'PO line is missing its stock item' }, { status: 400 });
        try {
          await resolveStockUnitConversion(prisma, existing.stockItemId, unitOfMeasure);
        } catch (error: any) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        submittedIds.add(item.id);
        totalAmount += quantity * unitPrice;
      }

      await prisma.$transaction(async tx => {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id, id: { notIn: [...submittedIds] } } });
        for (const item of items) {
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          const conversionToBase = await resolveStockUnitConversion(tx, existingById.get(item.id)!.stockItemId!, String(item.unitOfMeasure).toUpperCase() as UnitOfMeasure);
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { description: item.description.trim(), quantity, unitOfMeasure: String(item.unitOfMeasure).toUpperCase() as UnitOfMeasure, unitPrice, totalPrice: quantity * unitPrice, conversionToBase },
          });
        }
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { totalAmount, updatedBy: (session.user as any).id, updatedAt: new Date() } });
      });

      return NextResponse.json({ data: { success: true, totalAmount } });
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id: params.id, propertyId: ctx.propertyIds[0] },
      data: {
        ...(notes !== undefined && { notes }),
        ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
      },
    });

    return NextResponse.json({ data: updatedPo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

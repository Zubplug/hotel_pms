import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";
import { requireEntitlement } from '@/lib/auth/entitlement';

const STOCK_ITEM_TYPES = ['SELLABLE', 'RAW_MATERIAL', 'CONSUMABLE', 'CLEANING', 'HOUSEKEEPING', 'ASSET', 'PACKAGING'] as const;

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
        await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const item = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId: ctx.propertyIds[0] },
            include: {
                warehouse: true,
                stockUnits: { orderBy: { unit: 'asc' } },
                alerts: {
                    where: { status: 'OPEN' },
                },
            },
        });

        if (!item) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });

        return NextResponse.json({ data: item, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
        await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, sku, barcode, stockType, reorderLevel, isActive, quantityOnHand, costPrice } = body;

        if (quantityOnHand !== undefined && (!Number.isFinite(Number(quantityOnHand)) || Number(quantityOnHand) < 0)) return NextResponse.json({ error: 'Quantity must be zero or greater', data: null }, { status: 400 });
        if (costPrice !== undefined && (!Number.isFinite(Number(costPrice)) || Number(costPrice) < 0)) return NextResponse.json({ error: 'Cost per unit must be zero or greater', data: null }, { status: 400 });

        if (stockType !== undefined && !STOCK_ITEM_TYPES.includes(stockType)) {
            return NextResponse.json({ error: 'Invalid stock type', data: null }, { status: 400 });
        }

        const existing = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId: ctx.propertyIds[0] },
            include: { warehouse: { select: { posOutletId: true } } },
        });

        if (!existing) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });
        if (body.mainWarehouseOnly === true && existing.warehouse.posOutletId !== null) {
            return NextResponse.json({ error: 'Live stock edits are restricted to the main stock manager warehouse', data: null }, { status: 400 });
        }

        const updated = await prisma.stockItem.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(sku !== undefined && { sku }),
                ...(barcode !== undefined && { barcode }),
                ...(stockType !== undefined && { stockType }),
                ...(reorderLevel !== undefined && { reorderLevel: reorderLevel === null || reorderLevel === '' ? null : parseFloat(String(reorderLevel)) }),
                ...(quantityOnHand !== undefined && { quantityOnHand: Number(quantityOnHand) }),
                ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json({ data: updated, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
        await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const existing = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId: ctx.propertyIds[0] },
        });

        if (!existing) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });

        const deleted = await prisma.stockItem.update({
            where: { id: params.id },
            data: { isActive: false },
        });

        return NextResponse.json({ data: deleted, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

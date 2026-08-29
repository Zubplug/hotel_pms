import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

const STOCK_ITEM_TYPES = ['SELLABLE', 'RAW_MATERIAL', 'CONSUMABLE', 'CLEANING', 'HOUSEKEEPING', 'ASSET', 'PACKAGING'] as const;

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const item = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId },
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
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, sku, barcode, stockType, reorderLevel, isActive } = body;

        if (stockType !== undefined && !STOCK_ITEM_TYPES.includes(stockType)) {
            return NextResponse.json({ error: 'Invalid stock type', data: null }, { status: 400 });
        }

        const existing = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId },
        });

        if (!existing) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });

        const updated = await prisma.stockItem.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(sku !== undefined && { sku }),
                ...(barcode !== undefined && { barcode }),
                ...(stockType !== undefined && { stockType }),
                ...(reorderLevel !== undefined && { reorderLevel: parseFloat(reorderLevel) }),
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
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const existing = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId },
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

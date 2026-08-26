import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const item = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId },
            include: {
                warehouse: true,
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, sku, barcode, costPrice, reorderLevel, isActive } = body;

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
                ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
                ...(reorderLevel !== undefined && { reorderLevel: parseFloat(reorderLevel) }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json({ data: updated, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

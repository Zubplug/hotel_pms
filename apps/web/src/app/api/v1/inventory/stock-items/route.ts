import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const warehouseId = searchParams.get('warehouseId');
        const search = searchParams.get('search');
        const isActiveStr = searchParams.get('isActive');
        const isActive = isActiveStr === 'false' ? false : true;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;

        const where: any = { propertyId, isActive };
        if (warehouseId) where.warehouseId = warehouseId;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.stockItem.findMany({
                where,
                skip,
                take: limit,
                include: { warehouse: true },
            }),
            prisma.stockItem.count({ where }),
        ]);

        return NextResponse.json({ data: { items, total, page, limit }, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { warehouseId, name, sku, barcode, baseUnit, costPrice, reorderLevel, isActive = true } = body;

        const warehouse = await prisma.warehouse.findFirst({
            where: { id: warehouseId, propertyId },
        });

        if (!warehouse) {
            return NextResponse.json({ error: 'Warehouse not found or unauthorized', data: null }, { status: 404 });
        }

        const item = await prisma.stockItem.create({
            data: {
                propertyId,
                warehouseId,
                name,
                sku,
                barcode,
                baseUnit,
                costPrice: parseFloat(costPrice),
                reorderLevel: reorderLevel ? parseFloat(reorderLevel) : null,
                isActive,
            },
        });

        return NextResponse.json({ data: item, error: null }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

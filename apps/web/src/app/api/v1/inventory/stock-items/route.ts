import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

const STOCK_ITEM_TYPES = ['SELLABLE', 'RAW_MATERIAL', 'CONSUMABLE', 'CLEANING', 'HOUSEKEEPING', 'ASSET', 'PACKAGING'] as const;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const warehouseId = searchParams.get('warehouseId');
        const categoryId = searchParams.get('categoryId');
        const stockType = searchParams.get('stockType');
        const search = searchParams.get('search');
        const isActiveStr = searchParams.get('isActive');
        const isActive = isActiveStr === 'false' ? false : true;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;

        const where: any = { propertyId, isActive };
        if (warehouseId) where.warehouseId = warehouseId;
        if (stockType && STOCK_ITEM_TYPES.includes(stockType as typeof STOCK_ITEM_TYPES[number])) where.stockType = stockType;
        
        const andConditions = [];
        if (categoryId) {
            andConditions.push({
                OR: [
                    { categoryId: categoryId },
                    { posProduct: { categoryId: categoryId } }
                ]
            });
        }
        if (search) {
            andConditions.push({
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search, mode: 'insensitive' } },
                ]
            });
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const [items, total] = await Promise.all([
            prisma.stockItem.findMany({
                where,
                skip,
                take: limit,
                include: { 
                    warehouse: true,
                    stockUnits: { orderBy: { unit: 'asc' } },
                    posProduct: { include: { category: true } },
                    inventoryCategory: true
                },
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
        const { warehouseId, name, sku, barcode, baseUnit, stockType = 'CONSUMABLE', reorderLevel, isActive = true } = body;

        if (!STOCK_ITEM_TYPES.includes(stockType)) {
            return NextResponse.json({ error: 'Invalid stock type', data: null }, { status: 400 });
        }

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
                stockType,
                costPrice: 0, // Default to 0, MAC computes actual cost on first GRN
                reorderLevel: reorderLevel ? parseFloat(reorderLevel) : null,
                isActive,
            },
        });

        return NextResponse.json({ data: item, error: null }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

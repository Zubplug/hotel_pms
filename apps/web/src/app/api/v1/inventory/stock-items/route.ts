import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import prisma, { StockItemType, UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";
import { generateStockBarcode, generateStockSku } from '@/lib/inventory/identifiers';
import { requireEntitlement } from '@/lib/auth/entitlement';

const STOCK_ITEM_TYPES = Object.values(StockItemType) as StockItemType[];
const UNITS = Object.values(UnitOfMeasure) as UnitOfMeasure[];

function normalizeStockName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const warehouseId = searchParams.get('warehouseId');
        const categoryId = searchParams.get('categoryId');
        const stockType = searchParams.get('stockType');
        const search = searchParams.get('search');
        const isActiveStr = searchParams.get('isActive');
        const isMainWarehouseStr = searchParams.get('isMainWarehouse');
        const isActive = isActiveStr === 'false' ? false : true;
        const requestedPage = parseInt(searchParams.get('page') || '1', 10);
        const requestedLimit = parseInt(searchParams.get('limit') || '50', 10);
        const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        // Keep autocomplete and regular list requests bounded server-side.
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;
        const skip = (page - 1) * limit;

        const where: any = { propertyId: { in: ctx.propertyIds as string[] }, isActive };
        if (warehouseId) where.warehouseId = warehouseId;
        if (isMainWarehouseStr === 'true') {
            where.warehouse = { posOutletId: null };
        } else if (isMainWarehouseStr === 'false') {
            where.warehouse = { posOutletId: { not: null } };
        }
        if (stockType && STOCK_ITEM_TYPES.includes(stockType as StockItemType)) where.stockType = stockType;
        
        const andConditions = [];
        if (categoryId) {
            andConditions.push({ categoryId: categoryId });
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
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { warehouseId, name, sku, barcode, baseUnit, stockType = 'CONSUMABLE', reorderLevel, isActive = true } = body;
        const normalizedName = normalizeStockName(String(name || ''));

        if (!normalizedName) {
            return NextResponse.json({ error: 'Stock name is required', data: null }, { status: 400 });
        }
        if (!UNITS.includes(baseUnit)) {
            return NextResponse.json({ error: 'Invalid base unit', data: null }, { status: 400 });
        }

        if (!STOCK_ITEM_TYPES.includes(stockType)) {
            return NextResponse.json({ error: 'Invalid stock type', data: null }, { status: 400 });
        }

        const warehouse = await prisma.warehouse.findFirst({
            where: { id: warehouseId, propertyId: ctx.propertyIds[0] },
        });

        if (!warehouse) {
            return NextResponse.json({ error: 'Warehouse not found or unauthorized', data: null }, { status: 404 });
        }
        if (warehouse.posOutletId !== null) {
            return NextResponse.json({ error: 'New stock items must be created in a main warehouse', data: null }, { status: 400 });
        }

        const existingInWarehouse = await prisma.stockItem.findMany({
            where: { propertyId: ctx.propertyIds[0], warehouseId, isActive: true },
            select: { id: true, name: true, sku: true },
        });
        const duplicateName = existingInWarehouse.find(item => normalizeStockName(item.name) === normalizedName);
        if (duplicateName) {
            return NextResponse.json({ error: `An active stock item named "${duplicateName.name}" already exists in this warehouse. Use the existing item instead of creating a duplicate.`, data: { existingId: duplicateName.id } }, { status: 409 });
        }
        const requestedSku = String(sku || '').trim();
        const duplicateSku = requestedSku && existingInWarehouse.find(item => item.sku?.trim().toLowerCase() === requestedSku.toLowerCase());
        if (duplicateSku) {
            return NextResponse.json({ error: `SKU "${requestedSku}" already exists in this warehouse.`, data: { existingId: duplicateSku.id } }, { status: 409 });
        }

        const seed = randomUUID();
        const generatedSku = String(sku || '').trim() || generateStockSku(seed);
        let generatedBarcode = String(barcode || '').trim();
        for (let attempt = 0; !generatedBarcode && attempt < 10; attempt++) {
            const candidate = generateStockBarcode(ctx.propertyIds[0], seed, attempt);
            const existingBarcode = await prisma.stockItem.findFirst({
                where: { propertyId: ctx.propertyIds[0], barcode: candidate },
                select: { id: true },
            });
            if (!existingBarcode) generatedBarcode = candidate;
        }
        if (!generatedBarcode) return NextResponse.json({ error: 'Could not generate a unique barcode', data: null }, { status: 409 });

        const item = await prisma.$transaction(async (tx) => {
            const mainItem = await tx.stockItem.create({
                data: {
                    propertyId: ctx.propertyIds[0],
                    warehouseId,
                    name,
                    sku: generatedSku,
                    barcode: generatedBarcode,
                    baseUnit,
                    stockType,
                    costPrice: 0, // Default to 0, MAC computes actual cost on first GRN
                    reorderLevel: reorderLevel !== undefined && reorderLevel !== null && String(reorderLevel).trim() !== '' ? parseFloat(reorderLevel) : null,
                    isActive,
                },
            });

            return mainItem;
        });

        return NextResponse.json({ data: item, error: null }, { status: 201 });
    } catch (error: any) {
        if (error?.code === 'P2002') return NextResponse.json({ error: 'An active stock item with the same name or identifier already exists in this warehouse.', data: null }, { status: 409 });
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

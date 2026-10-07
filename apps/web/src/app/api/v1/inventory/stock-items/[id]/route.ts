import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma, { UnitOfMeasure } from '@hotel-pms/db';
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
        const canManageInventory = hasInventoryPermission(role, 'inventory.manage', isSuperAdmin);
        const canManageOutletStock = hasInventoryPermission(role, 'inventory.outlet.manage', isSuperAdmin);
        if (!canManageInventory && !canManageOutletStock) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, sku, barcode, baseUnit, baseConversion, stockType, reorderLevel, isActive, quantityOnHand, costPrice } = body;

        if (quantityOnHand !== undefined && (!Number.isFinite(Number(quantityOnHand)) || Number(quantityOnHand) < 0)) return NextResponse.json({ error: 'Quantity must be zero or greater', data: null }, { status: 400 });
        if (costPrice !== undefined && (!Number.isFinite(Number(costPrice)) || Number(costPrice) < 0)) return NextResponse.json({ error: 'Cost per unit must be zero or greater', data: null }, { status: 400 });
        const requestedBaseUnit = baseUnit === undefined ? undefined : String(baseUnit).toUpperCase();
        if (requestedBaseUnit !== undefined && !Object.values(UnitOfMeasure).includes(requestedBaseUnit as UnitOfMeasure)) {
            return NextResponse.json({ error: 'Invalid base unit', data: null }, { status: 400 });
        }

        if (stockType !== undefined && !STOCK_ITEM_TYPES.includes(stockType)) {
            return NextResponse.json({ error: 'Invalid stock type', data: null }, { status: 400 });
        }

        const existing = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId: ctx.propertyIds[0] },
            include: { warehouse: { select: { posOutletId: true } } },
        });

        if (!existing) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });
        if (!canManageInventory && body.outletStockOnly !== true) return NextResponse.json({ error: 'Outlet stock edits require outlet scope', data: null }, { status: 403 });
        if (body.outletStockOnly === true && (!existing.warehouse.posOutletId || (!isSuperAdmin && !(ctx.outletIds as string[]).includes(existing.warehouse.posOutletId)))) {
            return NextResponse.json({ error: 'You can only edit stock in your assigned outlet warehouse', data: null }, { status: 403 });
        }
        if (body.mainWarehouseOnly === true && existing.warehouse.posOutletId !== null) {
            return NextResponse.json({ error: 'Live stock edits are restricted to the main stock manager warehouse', data: null }, { status: 400 });
        }

        const baseUnitChanged = requestedBaseUnit !== undefined && requestedBaseUnit !== existing.baseUnit;
        const conversion = Number(baseConversion);
        if (baseUnitChanged && (!canManageInventory || existing.warehouse.posOutletId !== null)) {
            return NextResponse.json({ error: 'Only main stock-manager items can change base unit', data: null }, { status: 400 });
        }
        if (baseUnitChanged && (!Number.isFinite(conversion) || conversion <= 0)) {
            return NextResponse.json({ error: 'Enter how many new base units make one current base unit', data: null }, { status: 400 });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const rawQuantity = quantityOnHand === undefined ? Number(existing.quantityOnHand) : Number(quantityOnHand);
            const rawCost = costPrice === undefined ? Number(existing.costPrice) : Number(costPrice);
            const convertedQuantity = baseUnitChanged ? rawQuantity * conversion : rawQuantity;
            const convertedCost = baseUnitChanged ? rawCost / conversion : rawCost;

            if (baseUnitChanged) {
                const identity = existing.sku
                    ? { sku: existing.sku }
                    : { name: { equals: existing.name, mode: 'insensitive' as const } };
                const relatedItems = await tx.stockItem.findMany({
                    where: { propertyId: existing.propertyId, isActive: true, ...identity },
                    include: { stockUnits: true },
                });

                for (const related of relatedItems) {
                    const isCurrent = related.id === existing.id;
                    const nextQuantity = isCurrent ? convertedQuantity : Number(related.quantityOnHand) * conversion;
                    const nextCost = isCurrent ? convertedCost : Number(related.costPrice) / conversion;
                    await tx.stockItem.update({
                        where: { id: related.id },
                        data: { baseUnit: requestedBaseUnit as UnitOfMeasure, quantityOnHand: nextQuantity, costPrice: nextCost },
                    });
                    for (const unit of related.stockUnits) {
                        if (unit.unit === requestedBaseUnit) {
                            await tx.stockItemUnit.delete({ where: { id: unit.id } });
                        } else {
                            await tx.stockItemUnit.update({ where: { id: unit.id }, data: { unitsInBase: Number(unit.unitsInBase) * conversion } });
                        }
                    }
                    const transactions = await tx.stockTransaction.findMany({ where: { stockItemId: related.id } });
                    for (const transaction of transactions) {
                        await tx.stockTransaction.update({
                            where: { id: transaction.id },
                            data: {
                                quantity: Number(transaction.quantity) * conversion,
                                quantityBefore: Number(transaction.quantityBefore) * conversion,
                                quantityAfter: Number(transaction.quantityAfter) * conversion,
                                unitCost: Number(transaction.unitCost) / conversion,
                            },
                        });
                    }
                }
            }

            return tx.stockItem.update({
                where: { id: params.id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(sku !== undefined && { sku }),
                    ...(barcode !== undefined && { barcode }),
                    ...(baseUnitChanged && { baseUnit: requestedBaseUnit as UnitOfMeasure, quantityOnHand: convertedQuantity, costPrice: convertedCost }),
                    ...(stockType !== undefined && { stockType }),
                    ...(reorderLevel !== undefined && { reorderLevel: reorderLevel === null || reorderLevel === '' ? null : parseFloat(String(reorderLevel)) }),
                    ...(quantityOnHand !== undefined && !baseUnitChanged && { quantityOnHand: Number(quantityOnHand) }),
                    ...(costPrice !== undefined && !baseUnitChanged && { costPrice: Number(costPrice) }),
                    ...(isActive !== undefined && { isActive }),
                },
            });
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

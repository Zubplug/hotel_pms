import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireStockUnitConversion } from '@/lib/inventory/UnitConversionService';
import { getUnitConversionToBase } from '@/lib/inventory/units';
import { isKitchenProductionStation, kitchenServiceOutletId } from '@/lib/inventory/kitchen-routing';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    const product = await prisma.posProduct.findUnique({
      where: { id: productId },
      select: {
        propertyId: true,
        productionStation: true,
        category: { select: { outletId: true, productionStation: true } },
      },
    });
    if (!product) return NextResponse.json({ data: [], error: 'Product not found' }, { status: 404 });

    const property = await prisma.property.findUnique({ where: { id: product.propertyId }, select: { settings: true } });
    const station = product.productionStation ?? product.category?.productionStation ?? 'KITCHEN';
    const kitchenOutletId = property ? kitchenServiceOutletId(property.settings) : null;
    const targetOutletId = isKitchenProductionStation(station) ? kitchenOutletId : product.category?.outletId;
    const targetWarehouse = targetOutletId
      ? await prisma.warehouse.findUnique({ where: { posOutletId: targetOutletId }, select: { id: true } })
      : null;

    const modifiers = await prisma.posProductModifier.findMany({
      where: { productId, isActive: true },
      orderBy: { name: 'asc' },
      include: { stockItem: { select: { id: true, name: true, sku: true, barcode: true, baseUnit: true, stockUnits: true } } },
    });

    const targetItems = targetWarehouse
      ? await prisma.stockItem.findMany({ where: { warehouseId: targetWarehouse.id, isActive: true }, select: { name: true, sku: true, barcode: true, quantityOnHand: true } })
      : [];
    const enriched = modifiers.map((modifier) => {
      const stockItem = modifier.stockItem;
      if (!modifier.stockItemId || !stockItem) return { ...modifier, stockStatus: 'NON_STOCK', availableQuantity: null, availabilityIssue: null, stockItem: undefined };
      const target = targetItems.find((item) =>
        (stockItem.barcode && item.barcode === stockItem.barcode) ||
        (stockItem.sku && item.sku === stockItem.sku) ||
        item.name.trim().toLowerCase() === stockItem.name.trim().toLowerCase());
      const conversion = getUnitConversionToBase(modifier.unitOfMeasure, stockItem.baseUnit, stockItem.stockUnits || []);
      const required = Number(modifier.quantity || 0) * conversion;
      const availableQuantity = target ? Number(target.quantityOnHand || 0) : 0;
      const available = required > 0 ? availableQuantity / required : 0;
      const availabilityIssue = conversion <= 0 ? 'MISSING_CONVERSION' : !target ? 'MISSING_TARGET_STOCK' : availableQuantity <= 0 ? 'ZERO_STOCK' : available < 1 ? 'INSUFFICIENT_STOCK' : null;
      return {
        ...modifier,
        stockStatus: availabilityIssue ? 'OUT_OF_STOCK' : 'IN_STOCK',
        availableQuantity,
        availabilityIssue,
        stockItem: undefined,
      };
    });

    return NextResponse.json({ data: enriched, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Only managers can directly create live modifiers', 403);
    const { productId } = await params;
    const body = await req.json();
    const name = String(body.name || '').trim();
    const price = Number(body.price ?? 0);
    const quantity = Number(body.quantity ?? 1);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) return errorResponse('BAD_REQUEST', 'Modifier name, valid price, and quantity are required', 400);

    const product = await prisma.posProduct.findUnique({ where: { id: productId }, select: { propertyId: true } });
    if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);
    const allowed = (await requireOrganizationContext(user.id)).propertyIds;
    if (!allowed.includes(product.propertyId) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'No access to this property', 403);
    const groupName = body.groupName ? String(body.groupName).trim() : null;
    const groupMaxSelect = body.groupMaxSelect == null ? null : Number(body.groupMaxSelect);
    if (groupMaxSelect !== null && (!Number.isInteger(groupMaxSelect) || groupMaxSelect < 1)) return errorResponse('BAD_REQUEST', 'Maximum selection must be a positive whole number', 400);
    if (body.groupRequired === true && !groupName) return errorResponse('BAD_REQUEST', 'Required modifiers must belong to a group', 400);
    if (body.stockItemId) await requireStockUnitConversion(prisma, String(body.stockItemId), body.unitOfMeasure || '');
    const modifier = await prisma.posProductModifier.create({
      data: {
        productId,
        name,
        price,
        isActive: true,
        stockItemId: body.stockItemId || null,
        quantity,
        unitOfMeasure: body.unitOfMeasure || null,
        groupName,
        groupRequired: body.groupRequired === true,
        groupMaxSelect,
      },
    });
    // Desktop incremental sync watches the parent product watermark because
    // modifiers do not have their own updatedAt column.
    await prisma.posProduct.update({ where: { id: productId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ data: modifier, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

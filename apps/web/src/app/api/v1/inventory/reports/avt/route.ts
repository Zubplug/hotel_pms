import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID is required', data: null }, { status: 400 });
    }

    const where: any = { 
      id: warehouseId, 
      propertyId: { in: ctx.propertyIds as string[] } 
    };

    if (!['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'GENERAL_CASHIER'].includes(role)) {
      where.posOutletId = { in: ctx.outletIds as string[] };
    }

    // 1. Authorize Warehouse
    const warehouse = await prisma.warehouse.findFirst({
      where,
      select: {
        id: true,
        name: true,
        propertyId: true,
        parentWarehouseId: true,
        posOutletId: true,
      },
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found or unauthorized', data: null }, { status: 404 });
    }

    // 2. Fetch all active stock items for this warehouse
    const stockItems = await prisma.stockItem.findMany({
      where: { warehouseId, isActive: true },
      include: {
        inventoryCategory: true
      },
      orderBy: { name: 'asc' }
    });
    // Purchase setup is controlled by the supplying main warehouse. Prefer the
    // selected outlet's parent warehouse so duplicate item names in another
    // main warehouse cannot leak into this outlet's F&B view.
    const parentWarehouse = warehouse.parentWarehouseId
      ? await prisma.warehouse.findFirst({
          where: { id: warehouse.parentWarehouseId, propertyId: warehouse.propertyId, posOutletId: null, isActive: true },
          select: { id: true },
        })
      : null;
    const sourceWarehouseIds = parentWarehouse
      ? [parentWarehouse.id]
      : (await prisma.warehouse.findMany({
          where: { propertyId: warehouse.propertyId, posOutletId: null, isActive: true },
          select: { id: true },
        })).map((source) => source.id);
    const mainStockItems = await prisma.stockItem.findMany({
      where: { propertyId: warehouse.propertyId, warehouseId: { in: sourceWarehouseIds }, isActive: true },
      include: { stockUnits: true },
    });

    // 3. Fetch the LATEST COMPLETED stocktake for this warehouse to prevent N+1 queries
    const latestStocktake = await prisma.stocktake.findFirst({
      where: { warehouseId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    // 4. Map the items and calculate Physical vs Book
    let totalItems = stockItems.length;
    let itemsCounted = 0;
    let shortageValue = 0;
    let overageValue = 0;
    let netVarianceValue = 0;

    const mappedItems = stockItems.map(item => {
      const bookQuantity = Number(item.quantityOnHand || 0);
      const costPrice = Number(item.costPrice || 0);
      
      let physicalQuantity: number | null = null;
      let varianceQuantity: number | null = null;
      let variancePercentage: number | null = null;
      let varianceValue: number | null = null;
      let lastStocktakeAt: Date | null = null;

      if (latestStocktake) {
        // Find this item in the latest stocktake
        const countItem = latestStocktake.items.find(i => i.stockItemId === item.id);
        if (countItem) {
          itemsCounted++;
          physicalQuantity = Number(countItem.countedQty || 0);
          varianceQuantity = physicalQuantity - bookQuantity;
          varianceValue = varianceQuantity * costPrice;
          
          if (bookQuantity > 0) {
            variancePercentage = (varianceQuantity / bookQuantity) * 100;
          } else if (physicalQuantity > 0) {
            variancePercentage = 100; // Found items not in book
          } else {
            variancePercentage = 0;
          }

          lastStocktakeAt = latestStocktake.createdAt;

          // Aggregations
          netVarianceValue += varianceValue;
          if (varianceValue < 0) {
            shortageValue += Math.abs(varianceValue);
          } else if (varianceValue > 0) {
            overageValue += varianceValue;
          }
        }
      }

      return {
        stockItemId: item.id,
        itemCode: item.sku || item.id.slice(0, 8).toUpperCase(),
        name: item.name,
        category: item.inventoryCategory?.name || 'Uncategorized',
        unit: item.baseUnit,
        bookQuantity,
        physicalQuantity,
        varianceQuantity,
        variancePercentage,
        costPrice,
        varianceValue,
        lastStocktakeAt
        ,mainStock: (() => {
          const sameName = mainStockItems.filter(candidate => candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase());
          const main = (item.sku && mainStockItems.find(candidate => candidate.sku === item.sku))
            || (item.barcode && mainStockItems.find(candidate => candidate.barcode === item.barcode))
            || (sameName.length === 1 ? sameName[0] : sameName.find(candidate => candidate.stockType === item.stockType));
          if (!main) return null;
          const purchase = main.stockUnits.find(unit => unit.isPurchaseUnit);
          return {
            baseUnit: main.baseUnit,
            costPrice: Number(main.costPrice || 0),
            purchaseCost: purchase?.purchaseCost == null ? null : Number(purchase.purchaseCost),
            purchaseUnit: purchase?.unit || main.baseUnit,
            unitsInBase: purchase ? Number(purchase.unitsInBase) : 1,
          };
        })()
      };
    });

    const responsePayload = {
      warehouse: {
      id: warehouse.id,
      name: warehouse.name,
      parentWarehouseId: warehouse.parentWarehouseId,
      posOutletId: warehouse.posOutletId
      },
      summary: {
        totalItems,
        itemsCounted,
        shortageValue,
        overageValue,
        netVarianceValue
      },
      items: mappedItems
    };

    return NextResponse.json({ data: responsePayload, error: null });
  } catch (error: any) {
    console.error('Inventory AvT Error:', error);
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

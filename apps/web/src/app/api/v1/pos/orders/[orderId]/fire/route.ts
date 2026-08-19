import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { ProductionStation } from '@hotel-pms/db';

// POST /api/v1/pos/orders/[orderId]/fire
// Fires additional items to an existing IN_SERVICE order.
// Creates new PosOrderItem records and PosProductionBatch records.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Operator token required' }, { status: 401 });
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired operator token' }, { status: 401 });
    }

    const body = await req.json();
    const { items = [] } = body as {
      items: Array<{
        productId?: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        taxAmount?: number;
        total: number;
        modifiers?: Array<{ name: string; price?: number }>;
        course?: number;
      }>;
    };

    if (!items.length) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }

    // Verify the order exists
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.propertyId !== payload.propertyId || (payload.outletId && order.outletId !== payload.outletId)) {
      return NextResponse.json({ error: 'Context mismatch: token does not match order context' }, { status: 403 });
    }
    if (order.status === 'CLOSED' || order.status === 'VOIDED') {
      return NextResponse.json({ error: `Cannot fire items on a ${order.status} order` }, { status: 400 });
    }

    // Fetch products with categories to resolve productionStation
    const productIds = items.filter(i => i.productId).map(i => i.productId!);
    const products = productIds.length
      ? await prisma.posProduct.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            productionStation: true,
            category: { select: { productionStation: true } },
          },
        })
      : [];

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    function resolveStation(item: (typeof items)[0]): ProductionStation {
      const product = productMap.get(item.productId!);
      if (product?.productionStation) return product.productionStation as ProductionStation;
      if (product?.category?.productionStation) return product.category.productionStation as ProductionStation;
      return 'KITCHEN';
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create new order items
      const createdItems = await Promise.all(
        items.map(item =>
          tx.posOrderItem.create({
            data: {
              orderId,
              productId:    item.productId ?? null,
              productName:  item.productName,
              quantity:     item.quantity,
              unitPrice:    item.unitPrice,
              subtotal:     item.unitPrice * item.quantity,
              taxRate:      item.taxRate ?? 0,
              taxAmount:    item.taxAmount ?? 0,
              total:        item.total,
              course:       item.course ?? null,
              kitchenStatus: 'SENT',
              sentToKitchenAt: new Date(),
              modifiers: item.modifiers?.length
                ? {
                    create: item.modifiers.map(m => ({
                      name:  m.name,
                      price: m.price ?? 0,
                    })),
                  }
                : undefined,
            },
          })
        )
      );

      // Get current max batch numbers per station for this order
      const existingBatches = await tx.posProductionBatch.groupBy({
        by: ['station'],
        where: { orderId },
        _max: { batchNumber: true },
      });
      const batchNumberMap = new Map<string, number>(
        existingBatches.map((b: any) => [b.station, b._max.batchNumber ?? 0])
      );

      // Group new items by station (excluding DIRECT and NONE)
      const stationGroups = new Map<ProductionStation, Array<{ id: string; item: (typeof items)[0] }>>();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const station = resolveStation(item);
        if (station === 'DIRECT' || station === 'NONE') continue;

        if (!stationGroups.has(station)) stationGroups.set(station, []);
        stationGroups.get(station)!.push({ id: createdItems[i].id, item });
      }

      // Create new batches with incremented batch numbers
      const newBatches = [];
      for (const [station, stationItems] of stationGroups) {
        const prevMax = batchNumberMap.get(station) ?? 0;
        const batch = await tx.posProductionBatch.create({
          data: {
            orderId,
            batchNumber: prevMax + 1,
            station,
            status: 'PENDING',
            firedAt: new Date(),
            firedByStaffId: payload.staffId,
            items: {
              create: stationItems.map(({ id: orderItemId, item }) => ({
                orderItem: { connect: { id: orderItemId } },
                productName: item.productName,
                quantity: item.quantity,
                modifiers: item.modifiers ?? undefined,
                course: item.course ?? null,
              })),
            },
          },
          include: { items: true },
        });
        newBatches.push(batch);
      }

      // Recalculate order totals
      const allItems = await tx.posOrderItem.findMany({ where: { orderId } });
      const newSubtotal = allItems.reduce((s: number, i: any) => s + Number(i.subtotal), 0);
      const newTaxAmount = allItems.reduce((s: number, i: any) => s + Number(i.taxAmount), 0);
      const newTotal = allItems.reduce((s: number, i: any) => s + Number(i.total), 0);

      // Advance order status to IN_SERVICE if currently SUBMITTED
      const updatedOrder = await tx.posOrder.update({
        where: { id: orderId },
        data: {
          status: order.status === 'SUBMITTED' ? 'IN_SERVICE' : order.status,
          subtotal: newSubtotal,
          taxAmount: newTaxAmount,
          total: newTotal,
        },
        include: {
          items: { include: { modifiers: true } },
          payments: true,
        },
      });

      return { order: updatedOrder, newBatches };
    });

    return NextResponse.json({ data: result, error: null }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/pos/orders/[orderId]/fire]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { PosOrderStatus, ProductionStation } from '@hotel-pms/db';

// POST /api/v1/pos/orders
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const body = await req.json();
    const {
      propertyId, outletId, sessionId, tableId, tableNumber,
      orderType = 'TABLE', displayName, roomId, reservationId,
      guestCount, subtotal, taxAmount, total,
      items = [], payments = [],
    } = body;

    let serverStaffId: string | null = null;
    let firedByStaffId: string | null = null;
    if (token) {
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }

      // Context binding validation
      const isPropertyMismatch = payload.propertyId !== propertyId;
      const isSessionMismatch = payload.sessionId !== sessionId;
      const isOutletMismatch = payload.outletId && payload.outletId !== outletId;

      if (isPropertyMismatch || isSessionMismatch || isOutletMismatch) {
        console.error('Context mismatch:', { payload, body: { propertyId, outletId, sessionId } });
        return NextResponse.json({ error: 'Context mismatch: token does not match request context' }, { status: 403 });
      }

      serverStaffId = payload.staffId;
      firedByStaffId = payload.staffId;
    }

    // Fetch products with their categories to resolve productionStation
    const productIds = items
      .filter((i: any) => i.productId)
      .map((i: any) => i.productId);

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

    // Resolve station per item
    function resolveStation(item: any): ProductionStation {
      const product = productMap.get(item.productId);
      if (product?.productionStation) return product.productionStation as ProductionStation;
      if (product?.category?.productionStation) return product.category.productionStation as ProductionStation;
      return 'KITCHEN';
    }

    const order = await prisma.$transaction(async (tx: any) => {
      // Generate human-readable order number
      const count = await tx.posOrder.count({ where: { propertyId } });
      const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

      const newOrder = await tx.posOrder.create({
        data: {
          propertyId,
          outletId,
          sessionId,
          tableId:       tableId ?? null,
          tableNumber:   tableNumber ?? null,
          orderType:     orderType,
          displayName:   displayName ?? null,
          roomId:        roomId ?? null,
          reservationId: reservationId ?? null,
          guestCount:    guestCount ?? 1,
          serverStaffId: serverStaffId ?? body.serverStaffId ?? null,
          orderNumber,
          status:        'SUBMITTED' as PosOrderStatus,
          paymentStatus: 'UNPAID',
          businessDate:  new Date(),
          subtotal,
          taxAmount,
          total,
          items: {
            create: items.map((item: any) => ({
              productId:    item.productId ?? null,
              productName:  item.productName,
              quantity:     item.quantity,
              unitPrice:    item.unitPrice,
              subtotal:     item.unitPrice * item.quantity,
              taxRate:      item.taxRate ?? 0,
              taxAmount:    item.taxAmount ?? 0,
              total:        item.total,
              course:       item.course ?? null,
              kitchenStatus: item.kitchenStatus ?? 'PENDING',
              modifiers: item.modifiers?.length
                ? {
                    create: item.modifiers.map((m: any) => ({
                      name:  m.name,
                      price: m.price ?? 0,
                    })),
                  }
                : undefined,
            })),
          },
          payments: payments.length
            ? {
                create: payments.map((p: any) => ({
                  method:   p.method,
                  amount:   p.amount,
                  currency: p.currency ?? 'NGN',
                  status:   (p.status ?? 'CONFIRMED') as any,
                  businessDate: new Date(),
                })),
              }
            : undefined,
        },
        include: {
          items: { include: { modifiers: true } },
          payments: true,
        },
      });

      // Group items by station (excluding DIRECT and NONE)
      const stationGroups = new Map<ProductionStation, Array<{ id: string; item: any }>>();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const station = resolveStation(item);
        if (station === 'DIRECT' || station === 'NONE') continue;

        if (!stationGroups.has(station)) stationGroups.set(station, []);
        stationGroups.get(station)!.push({ id: newOrder.items[i].id, item });
      }

      // Create production batches (batch #1)
      const batches = [];
      for (const [station, stationItems] of stationGroups) {
        const batch = await tx.posProductionBatch.create({
          data: {
            orderId: newOrder.id,
            batchNumber: 1,
            station,
            status: 'PENDING',
            firedAt: new Date(),
            firedByStaffId: firedByStaffId ?? null,
            items: {
              create: stationItems.map(({ id: orderItemId, item }) => ({
                orderItemId,
                productName: item.productName,
                quantity: item.quantity,
                modifiers: item.modifiers ?? null,
                course: item.course ?? null,
              })),
            },
          },
          include: { items: true },
        });
        batches.push(batch);
      }

      // If a table was selected, mark it as occupied
      if (tableId) {
        await tx.posTable.update({
          where: { id: tableId },
          data:  { currentOrderId: newOrder.id },
        });
      }

      return { ...newOrder, productionBatches: batches };
    });

    return NextResponse.json({ data: order, error: null }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/pos/orders]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

// GET /api/v1/pos/orders?sessionId=...&outletId=...&status=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const outletId  = searchParams.get('outletId');
    const status    = searchParams.get('status') as PosOrderStatus | null;

    const orders = await prisma.posOrder.findMany({
      where: {
        ...(sessionId ? { sessionId } : {}),
        ...(outletId  ? { outletId }  : {}),
        ...(status    ? { status }    : {}),
      },
      include: {
        items:    { include: { modifiers: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data: orders, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}

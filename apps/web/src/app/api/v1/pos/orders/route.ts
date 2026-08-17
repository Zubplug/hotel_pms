import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { PosOrderStatus } from '@hotel-pms/db';

// POST /api/v1/pos/orders
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const body = await req.json();
    const {
      propertyId, outletId, sessionId, tableId, tableNumber,
      guestCount, status, subtotal, taxAmount, total,
      items = [], payments = [],
    } = body;

    let serverStaffId: string | null = null;
    if (token) {
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }
      
      // Context binding validation
      if (payload.propertyId !== propertyId || payload.outletId !== outletId || payload.sessionId !== sessionId) {
        console.error('Context mismatch detailed debug:', {
          payloadPropertyId: payload.propertyId, bodyPropertyId: propertyId,
          payloadOutletId: payload.outletId, bodyOutletId: outletId,
          payloadSessionId: payload.sessionId, bodySessionId: sessionId
        });
        return NextResponse.json({ error: 'Context mismatch: token does not match request context' }, { status: 403 });
      }

      serverStaffId = payload.staffId;
    }

    const order = await prisma.$transaction(async (tx) => {
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
          guestCount:    guestCount ?? 1,
          serverStaffId: serverStaffId ?? body.serverStaffId ?? null,
          orderNumber,
          status:       (status ?? 'OPEN') as PosOrderStatus,
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
                })),
              }
            : undefined,
        },
        include: {
          items: { include: { modifiers: true } },
          payments: true,
        },
      });

      // If a table was selected, mark it as occupied
      if (tableId) {
        await tx.posTable.update({
          where: { id: tableId },
          data:  { currentOrderId: newOrder.id },
        });
      }

      return newOrder;
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

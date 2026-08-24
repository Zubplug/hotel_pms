import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const reservationId = searchParams.get('reservationId');

    const allowedProperties = await getUserPropertyIds(session.user.id);
    if (!allowedProperties.length) return successResponse([]);

    if (propertyId && !allowedProperties.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Access denied to property', 403);
    }

    const orders = await prisma.laundryOrder.findMany({
      where: {
        propertyId: {
          in: propertyId ? [propertyId] : allowedProperties
        },
        ...(status ? { status: status as any } : {}),
        ...(reservationId ? { reservationId } : {})
      },
      include: {
        reservation: {
          select: { confirmationNumber: true, primaryGuest: { select: { firstName: true, lastName: true } } }
        },
        room: { select: { number: true } },
        items: {
          include: {
            item: { select: { name: true, category: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(orders);
  } catch (err) {
    console.error('[LaundryOrders GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch laundry orders', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, reservationId, roomId, guestId, serviceType, specialNotes, items } = body;

    if (!propertyId || !reservationId || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const canCreate = await hasPermission(session.user.id, 'laundry', 'create', propertyId);
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // Calculate total price based on snapshot items
    let totalAmount = 0;
    const orderItemsData: any[] = [];

    // Fetch items from DB to ensure correct prices
    const itemIds = items.map((i: any) => i.itemId);
    const dbItems = await prisma.laundryItem.findMany({
      where: { id: { in: itemIds }, propertyId, isActive: true }
    });

    const itemMap = new Map(dbItems.map(i => [i.id, i]));

    for (const orderItem of items) {
      const dbItem = itemMap.get(orderItem.itemId);
      if (!dbItem) continue;

      let unitPrice = Number(dbItem.basePrice);
      
      // Apply service pricing rules if they exist
      // Apply service pricing rules if they exist, otherwise use default multipliers
      if (dbItem.servicePricingRules && (dbItem.servicePricingRules as any)[serviceType]) {
          const rule = (dbItem.servicePricingRules as any)[serviceType];
          if (rule.type === 'FIXED') {
              unitPrice = rule.amount;
          } else if (rule.type === 'MULTIPLIER') {
              unitPrice = unitPrice * rule.value;
          }
      } else {
          // Default multipliers
          if (serviceType === 'EXPRESS') {
              unitPrice = unitPrice * 1.5;
          } else if (serviceType === 'DRY_CLEAN') {
              unitPrice = unitPrice * 2.0;
          }
      }

      const totalPrice = unitPrice * orderItem.quantity;
      totalAmount += totalPrice;

      orderItemsData.push({
        itemId: orderItem.itemId,
        quantity: orderItem.quantity,
        unitPrice,
        totalPrice
      });
    }

    if (orderItemsData.length === 0) {
      return errorResponse('BAD_REQUEST', 'No valid items provided', 400);
    }

    const order = await prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.laundryOrder.create({
        data: {
          propertyId,
          reservationId,
          roomId,
          guestId,
          serviceType: serviceType || 'STANDARD',
          specialNotes,
          totalAmount,
          currency: dbItems[0].currency,
          placedBy: session.user.id,
          items: {
            create: orderItemsData
          }
        }
      });

      await tx.laundryOrderStatusHistory.create({
        data: {
          laundryOrderId: newOrder.id,
          newStatus: 'PENDING',
          changedBy: session.user.id,
          notes: 'Order placed'
        }
      });

      return newOrder;
    });

    // NOTE: SyncEngine Outbox event for Desktop Parity
    // await createOutboxEvent('LaundryOrderCreated', { orderId: order.id });

    return successResponse(order, 201);
  } catch (err) {
    console.error('[LaundryOrders POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to create laundry order', 500);
  }
}

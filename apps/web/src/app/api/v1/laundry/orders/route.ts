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
        guest: { select: { firstName: true, lastName: true, phone: true } },
        room: { select: { number: true } },
        items: {
          include: {
            item: { select: { name: true, category: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Manually stitch the folio details for walk-in delivered orders
    const walkInOrders = orders.filter(o => o.customerType === 'WALK_IN' && o.status === 'DELIVERED' && o.folioItemId);
    const folioItemIds = walkInOrders.map(o => o.folioItemId as string);
    let foliosByItemId: Record<string, any> = {};

    if (folioItemIds.length > 0) {
      const folioItems = await prisma.folioItem.findMany({
        where: { id: { in: folioItemIds } },
        include: { folio: true }
      });
      foliosByItemId = folioItems.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }

    const enhancedOrders = orders.map(order => {
      if (order.folioItemId && foliosByItemId[order.folioItemId]) {
        return {
          ...order,
          folioItem: foliosByItemId[order.folioItemId]
        };
      }
      return order;
    });

    return successResponse(enhancedOrders);
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
    const { propertyId, customerType, reservationId, roomId, guestId, walkInDetails, serviceType, specialNotes, items } = body;

    if (!propertyId || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const cType = customerType || 'IN_HOUSE';

    if (cType === 'IN_HOUSE') {
        if (!reservationId || !guestId) {
            return errorResponse('BAD_REQUEST', 'IN_HOUSE orders require reservationId and guestId', 400);
        }
    } else if (cType === 'WALK_IN') {
        if (reservationId || roomId) {
            return errorResponse('BAD_REQUEST', 'WALK_IN orders cannot have reservationId or roomId', 400);
        }
        if (!walkInDetails?.phone || !walkInDetails?.firstName) {
            return errorResponse('BAD_REQUEST', 'WALK_IN orders require a first name and phone number', 400);
        }
    } else {
        return errorResponse('BAD_REQUEST', 'Invalid customerType', 400);
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
      let finalGuestId = guestId;

      if (cType === 'WALK_IN') {
          // Acquire transaction-level advisory lock based on phone number to prevent duplicate guest creation in concurrent requests
          const numericPhone = walkInDetails.phone.replace(/[^0-9]/g, '');
          const lockId = numericPhone ? Number(BigInt(numericPhone) % BigInt(2147483647)) : 123456789;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

          // Try to reuse guest by phone number
          const existingGuest = await tx.guest.findFirst({
              where: { 
                  phone: walkInDetails.phone,
                  organizationId: (await tx.property.findUnique({ where: { id: propertyId } }))?.organizationId || ''
              }
          });

          if (existingGuest) {
              finalGuestId = existingGuest.id;
          } else {
              const newGuest = await tx.guest.create({
                  data: {
                      organizationId: (await tx.property.findUnique({ where: { id: propertyId } }))?.organizationId || '',
                      firstName: walkInDetails.firstName,
                      lastName: walkInDetails.lastName || '',
                      phone: walkInDetails.phone,
                      email: walkInDetails.email || null,
                  }
              });
              finalGuestId = newGuest.id;
          }
      }

      const newOrder = await tx.laundryOrder.create({
        data: {
          propertyId,
          customerType: cType,
          reservationId: cType === 'IN_HOUSE' ? reservationId : null,
          roomId: cType === 'IN_HOUSE' ? roomId : null,
          guestId: finalGuestId,
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

    return successResponse(order, 201);
  } catch (err) {
    console.error('[LaundryOrders POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to create laundry order', 500);
  }
}

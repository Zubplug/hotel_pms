import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

// GET /api/v1/pos/sessions/[sessionId]/active-orders
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    // Require valid operator token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Invalid operator token' }, { status: 401 });
    }

    // Determine query scoping
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('filter') || 'my_orders'; // 'my_orders' | 'all_open'

    // Build the query where clause
    const where: any = {
      propertyId: payload.propertyId,
      status: { in: ['SUBMITTED', 'IN_SERVICE'] }
    };

    // Filter by outlet if token is outlet-bound
    if (payload.outletId) {
      where.outletId = payload.outletId;
    }

    // Optional: filter by business date (or session id)
    // If the token is bound to a session, we usually want all active orders for the current business date
    // For now, let's just fetch all open orders in this property/outlet.

    if (filterType === 'my_orders') {
      where.serverStaffId = payload.staffId;
    } else if (filterType === 'all_open') {
      // Here you would check if the staff has cross-view permissions. 
      // For now, assuming they do if they explicitly request 'all_open'.
      // A more robust implementation would check a permission flag on the staff record.
    }

    // Fetch lightweight summaries
    const orders = await prisma.posOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        tableNumber: true,
        displayName: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        serverStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format the response
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      tableName: order.tableNumber || null,
      displayName: order.displayName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      itemCount: order._count.items,
      total: Number(order.total),
      waiterName: order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName}`.trim() : 'Unknown',
      createdAt: order.createdAt
    }));

    return NextResponse.json({ data: formattedOrders, error: null }, { status: 200 });

  } catch (err: any) {
    console.error(`[GET /api/v1/pos/sessions/[sessionId]/active-orders]`, err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

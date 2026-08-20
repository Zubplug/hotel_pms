import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyOperatorToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired operator token' }, { status: 401 });
    }

    const staffId = payload.staffId as string;
    const propertyId = payload.propertyId as string;

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get('range') || 'today';
    const statusFilter = searchParams.get('status') || 'all';

    let dateFilter = {};
    const now = new Date();
    
    if (dateRange === 'today') {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { businessDate: { gte: today, lt: tomorrow } };
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);
      dateFilter = { businessDate: { gte: yesterday, lt: today } };
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      dateFilter = { businessDate: { gte: weekAgo } };
    }

    let statusCondition = {};
    if (statusFilter !== 'all') {
      statusCondition = { status: statusFilter.toUpperCase() };
    }

    const orders = await prisma.posOrder.findMany({
      where: {
        propertyId,
        serverStaffId: staffId,
        ...dateFilter,
        ...statusCondition
      },
      include: {
        payments: true,
        items: true,
        session: true,
        outlet: {
          select: { id: true, name: true }
        },
        serverStaff: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedOrders = orders.map((order: any) => ({
      ...order,
      sessionOwnerName: order.session?.openedBy ?? 'Unknown',
      verificationToken: `${order.orderNumber}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    }));

    return NextResponse.json({ data: formattedOrders });
  } catch (error) {
    console.error('Server Orders Report Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

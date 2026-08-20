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
    const businessDateParam = searchParams.get('businessDate');
    
    let dateFilter = {};
    if (businessDateParam) {
      const date = new Date(businessDateParam);
      // Create a range for the specific date
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      dateFilter = {
        businessDate: {
          gte: date,
          lt: nextDay
        }
      };
    } else {
      // Default to today if not provided
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      dateFilter = {
        businessDate: {
          gte: today,
          lt: tomorrow
        }
      };
    }

    const orders = await prisma.posOrder.findMany({
      where: {
        propertyId,
        serverStaffId: staffId,
        ...dateFilter,
      },
      include: {
        payments: true,
      }
    });

    let grossSales = 0;
    let totalDiscounts = 0;
    let netSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let roomCharges = 0;

    orders.forEach((order: any) => {
      if (order.status !== 'VOIDED') {
        const orderTotal = Number(order.total);
        const orderDiscount = Number(order.discount);
        
        grossSales += (orderTotal + orderDiscount);
        totalDiscounts += orderDiscount;
        netSales += orderTotal;

        order.payments.forEach((payment: any) => {
          const amount = Number(payment.amount);
          if (payment.method === 'CASH') cashSales += amount;
          else if (payment.method === 'CARD') cardSales += amount;
          else if (payment.method === 'ROOM_CHARGE') roomCharges += amount;
        });
      }
    });

    return NextResponse.json({ 
      data: {
        staffId,
        ordersCount: orders.length,
        grossSales,
        totalDiscounts,
        netSales,
        cashSales,
        cardSales,
        roomCharges,
      } 
    });
  } catch (error) {
    console.error('Server Sales Report Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = (session.user as any).role;
    const ALLOWED_ROLES = ['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO', 'FINANCE_MANAGER'];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to view managers flash report', 403);
    }

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    const businessDate = new Date(businessDateStr);

    const totalRooms = await prisma.room.count({
      where: { propertyId, status: { not: 'OUT_OF_ORDER' } }
    });

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    if (!nightAudit) {
      return errorResponse('NOT_FOUND', 'Night audit data not found for this date', 404);
    }

    const roomRevenue = Number(nightAudit.totalRoomRevenue) || 0;

    const posRevenueAggr = await prisma.posOrder.aggregate({
      where: { propertyId, businessDate, status: 'CLOSED' },
      _sum: { total: true }
    });
    const fbRevenue = Number(posRevenueAggr._sum.total || 0);

    const otherRevenueAggr = await prisma.folioItem.aggregate({
      where: { 
        folio: { propertyId }, 
        businessDate, 
        type: 'CHARGE',
        source: { notIn: ['ROOM_CHARGE', 'POS'] }
      },
      _sum: { amount: true }
    });
    const otherRevenue = Number(otherRevenueAggr._sum.amount || 0);
    const totalRevenue = roomRevenue + fbRevenue + otherRevenue;

    const report = {
      occupancy: {
        roomsAvailable: totalRooms,
        roomsSold: nightAudit.occupancy ? Math.round((Number(nightAudit.occupancy) / 100) * totalRooms) : 0,
        occupancyPercentage: Number(nightAudit.occupancy) || 0,
        adr: Number(nightAudit.adr) || 0,
        revpar: Number(nightAudit.revpar) || 0,
      },
      revenue: {
        room: roomRevenue,
        foodAndBeverage: fbRevenue,
        other: otherRevenue,
        total: totalRevenue
      }
    };

    return successResponse(report);

  } catch (err: any) {
    console.error('[Managers Flash GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

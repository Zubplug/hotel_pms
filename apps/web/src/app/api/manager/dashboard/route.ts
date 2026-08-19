import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Manager access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;

    if (allowedPropertyIds.length === 0) {
      return successResponse({
        occupancy: 0,
        todayRevenue: 0,
        adr: 0,
        revPAR: 0,
        alerts: {
          pendingApprovals: 0,
          maintenanceIssues: 0,
          lowStock: 0,
          operationalRooms: 0,
        }
      }, 200);
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's revenue (net collected)
    const payments = await prisma.payment.aggregate({
      where: {
        propertyId: { in: allowedPropertyIds },
        status: 'COMPLETED',
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });
    
    const refunds = await prisma.refund.aggregate({
      where: {
        propertyId: { in: allowedPropertyIds },
        status: 'COMPLETED',
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });

    const todayRevenue = Number(payments._sum.amount || 0) - Number(refunds._sum.amount || 0);

    // Get occupancy
    const rooms = await prisma.room.groupBy({
      by: ['status'],
      where: { propertyId: { in: allowedPropertyIds } },
      _count: true
    });

    let available = 0, occupied = 0, cleaning = 0, outOfOrder = 0;
    rooms.forEach(r => {
      if (r.status === 'AVAILABLE') available += r._count;
      else if (r.status === 'OCCUPIED' || r.status === 'RESERVED') occupied += r._count;
      else if (['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'].includes(r.status)) cleaning += r._count;
      else if (['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'].includes(r.status)) outOfOrder += r._count;
    });

    const sellableRooms = available + occupied + cleaning;
    const occupancy = sellableRooms > 0 ? (occupied / sellableRooms) * 100 : 0;
    const adr = occupied > 0 ? todayRevenue / occupied : 0;
    const revPAR = sellableRooms > 0 ? todayRevenue / sellableRooms : 0;
    const operationalRooms = available + occupied + cleaning;

    // Get Alerts
    const pendingApprovals = await prisma.approvalRequest.count({
      where: { propertyId: { in: allowedPropertyIds }, status: 'PENDING' }
    });
    
    const maintenanceIssues = outOfOrder; // outOfOrder is calculated from rooms
    
    const lowStock = await prisma.inventoryAlert.count({
      where: { propertyId: { in: allowedPropertyIds }, status: 'OPEN' }
    });

    return successResponse({
      occupancy,
      todayRevenue,
      adr,
      revPAR,
      alerts: {
        pendingApprovals,
        maintenanceIssues,
        lowStock,
        operationalRooms,
      }
    }, 200);

  } catch (err: any) {
    console.error('[Manager Dashboard API GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating manager dashboard', 500);
  }
}

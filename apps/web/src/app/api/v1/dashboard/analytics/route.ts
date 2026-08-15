import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

export const revalidate = 60; // 60-second cache

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    
    let propertyIdsToQuery: string[] = [];
    if (requestedPropertyId) {
      if (!allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
        return errorResponse('FORBIDDEN', 'No access to this property', 403);
      }
      propertyIdsToQuery = [requestedPropertyId];
    } else {
      propertyIdsToQuery = allowedPropertyIds;
    }

    if (propertyIdsToQuery.length === 0) {
      return successResponse({
        kpis: { netCollected30d: 0, occupancy: 0, activeGuests: 0, receivables: 0, operationalHealth: { available: 0, occupied: 0, cleaning: 0, outOfOrder: 0 } },
        revenueTrend: [],
        properties: [],
        activity: []
      }, 200);
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);

    // --- KPIs ---
    
    // 1. Net Collected 30d
    const paymentsAgg = await prisma.payment.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true }
    });
    
    const refundsAgg = await prisma.refund.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true }
    });

    const grossPayments = Number(paymentsAgg._sum.amount || 0);
    const totalRefunds = Number(refundsAgg._sum.amount || 0);
    const netCollected30d = grossPayments - totalRefunds;

    // 2 & 5. Occupancy Today & Operational Health
    const rooms = await prisma.room.groupBy({
      by: ['status'],
      where: { propertyId: { in: propertyIdsToQuery } },
      _count: true
    });

    let available = 0, occupied = 0, cleaning = 0, outOfOrder = 0;
    rooms.forEach(r => {
      if (r.status === 'AVAILABLE') available += r._count;
      else if (r.status === 'OCCUPIED' || r.status === 'RESERVED') occupied += r._count; // RESERVED isn't strictly occupied, but for simplicity
      else if (['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'].includes(r.status)) cleaning += r._count;
      else if (['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'].includes(r.status)) outOfOrder += r._count;
    });

    const sellableRooms = available + occupied + cleaning; 
    const totalRooms = sellableRooms + outOfOrder;
    const occupancy = sellableRooms > 0 ? (occupied / sellableRooms) * 100 : 0;
    
    const operationalHealth = {
      available: totalRooms > 0 ? (available / totalRooms) * 100 : 0,
      occupied: totalRooms > 0 ? (occupied / totalRooms) * 100 : 0,
      cleaning: totalRooms > 0 ? (cleaning / totalRooms) * 100 : 0,
      outOfOrder: totalRooms > 0 ? (outOfOrder / totalRooms) * 100 : 0,
    };

    // 3. Active Guests
    const activeGuests = await prisma.reservation.count({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: 'CHECKED_IN'
      }
    });

    // 4. Outstanding Receivables
    const foliosAgg = await prisma.folio.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery },
        balance: { gt: 0 }
      },
      _sum: { balance: true }
    });
    const receivables = Number(foliosAgg._sum.balance || 0);

    // --- Properties Comparison ---
    const propertiesData = await prisma.property.findMany({
      where: { id: { in: propertyIdsToQuery } },
      select: {
        id: true,
        name: true,
        rooms: { select: { status: true } },
        payments: {
          where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
          select: { amount: true }
        },
        refunds: {
          where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
          select: { amount: true }
        }
      }
    });

    const propertyComparisons = propertiesData.map(p => {
      let pAvailable = 0, pOccupied = 0, pCleaning = 0, pOutOfOrder = 0;
      p.rooms.forEach(r => {
        if (r.status === 'AVAILABLE') pAvailable++;
        else if (r.status === 'OCCUPIED' || r.status === 'RESERVED') pOccupied++;
        else if (['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'].includes(r.status)) pCleaning++;
        else if (['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'].includes(r.status)) pOutOfOrder++;
      });
      const pSellable = pAvailable + pOccupied + pCleaning;
      const pOccupancy = pSellable > 0 ? (pOccupied / pSellable) * 100 : 0;
      
      const pGross = p.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
      const pRefunds = p.refunds.reduce((sum, ref) => sum + Number(ref.amount), 0);
      const pNet = pGross - pRefunds;

      const adr = pOccupied > 0 ? pNet / pOccupied : 0; // Simplified ADR approximation using net collected

      return {
        id: p.id,
        name: p.name,
        occupancy: pOccupancy,
        netCollected: pNet,
        adr,
        outOfOrder: pOutOfOrder
      };
    });

    // --- Trend (14 days) ---
    // A more complex raw query would be ideal for exact historical room occupancy, 
    // but we will build a simpler approximation grouping payments by day.
    
    // Create an array of 14 days
    const trendData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      trendData.push({
        date: startOfDay.toISOString().split('T')[0],
        timestamp: startOfDay.getTime(),
        revenue: 0,
        occupancyPct: 0,
        roomNights: 0
      });
    }

    // Revenue per day
    const payments14d = await prisma.payment.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: 'COMPLETED',
        createdAt: { gte: fourteenDaysAgo }
      },
      select: { amount: true, createdAt: true }
    });
    const refunds14d = await prisma.refund.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: 'COMPLETED',
        createdAt: { gte: fourteenDaysAgo }
      },
      select: { amount: true, createdAt: true }
    });

    for (const item of trendData) {
      const pDay = payments14d.filter(p => new Date(p.createdAt).getTime() >= item.timestamp && new Date(p.createdAt).getTime() < item.timestamp + 86400000);
      const rDay = refunds14d.filter(r => new Date(r.createdAt).getTime() >= item.timestamp && new Date(r.createdAt).getTime() < item.timestamp + 86400000);
      const net = pDay.reduce((sum, p) => sum + Number(p.amount), 0) - rDay.reduce((sum, r) => sum + Number(r.amount), 0);
      item.revenue = net;
    }

    // We can approximate historical occupancy by finding all reservations that overlapped each day
    const reservations14d = await prisma.reservation.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery },
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, // Actually occupied
        checkIn: { lte: now },
        checkOut: { gte: fourteenDaysAgo }
      },
      select: { checkIn: true, checkOut: true }
    });

    const totalRoomsCount = sellableRooms > 0 ? sellableRooms : 1; // Approx total sellable for past 14d

    for (const item of trendData) {
      let roomNights = 0;
      for (const res of reservations14d) {
        const resStart = new Date(res.checkIn).getTime();
        const resEnd = new Date(res.checkOut).getTime();
        // Overlaps this day?
        if (resStart < item.timestamp + 86400000 && resEnd > item.timestamp) {
          roomNights++;
        }
      }
      item.roomNights = roomNights;
      item.occupancyPct = Math.min(100, (roomNights / totalRoomsCount) * 100);
    }

    // --- Live Activity ---
    const activity = await prisma.auditLog.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery },
        action: {
          in: ['GUEST_CHECK_IN', 'PAYMENT_RECEIVED', 'MAINTENANCE_TICKET_CREATED', 'ROOM_STATUS_UPDATED']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        resourceId: true,
        newValue: true,
        createdAt: true,
        propertyId: true
      }
    });

    return successResponse({
      kpis: {
        netCollected30d,
        occupancy,
        activeGuests,
        receivables,
        operationalHealth
      },
      trend: trendData.map(d => ({
        date: d.date,
        revenue: d.revenue,
        occupancyPct: Math.round(d.occupancyPct),
        roomNights: d.roomNights
      })),
      properties: propertyComparisons,
      activity: activity.map(a => ({
        id: a.id,
        action: a.action,
        property: propertiesData.find(p => p.id === a.propertyId)?.name || 'System',
        timeAgo: a.createdAt.toISOString(),
        details: a.newValue
      }))
    }, 200);

  } catch (err: any) {
    console.error('[Dashboard Analytics GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating analytics', 500);
  }
}

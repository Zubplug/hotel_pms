import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
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
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // Additional Occupancy metrics
    const startOfDay = new Date(businessDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(businessDate);
    endOfDay.setHours(23, 59, 59, 999);

    const arrivals = await prisma.reservation.count({
      where: { propertyId, checkIn: { gte: startOfDay, lte: endOfDay }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } }
    });
    
    const departures = await prisma.reservation.count({
      where: { propertyId, checkOut: { gte: startOfDay, lte: endOfDay }, status: 'CHECKED_OUT' }
    });

    const noShows = await prisma.reservation.count({
      where: { propertyId, checkIn: { gte: startOfDay, lte: endOfDay }, status: 'NO_SHOW' }
    });

    // We can assume walk-ins are those created and checked in on the same day
    const walkIns = await prisma.reservation.count({
      where: { propertyId, checkIn: { gte: startOfDay, lte: endOfDay }, createdAt: { gte: startOfDay, lte: endOfDay } }
    });

    // Revenue breakdown (Net, Taxes, Gross)
    const taxesAggr = await prisma.folioItem.aggregate({
      where: { folio: { propertyId }, businessDate, type: 'TAX' },
      _sum: { amount: true }
    });
    const totalTaxes = Number(taxesAggr._sum.amount || 0);

    const discountsAggr = await prisma.folioItem.aggregate({
      where: { folio: { propertyId }, businessDate, type: 'DISCOUNT' },
      _sum: { amount: true }
    });
    const totalDiscounts = Math.abs(Number(discountsAggr._sum.amount || 0));

    // Assume totalRevenue calculated earlier is Net Revenue. Gross = Net + Discounts. Total (with tax) = Net + Taxes
    const netRevenue = totalRevenue;
    const grossRevenue = netRevenue + totalDiscounts;
    const totalRevenueWithTax = netRevenue + totalTaxes;

    // Financial breakdown from Payments
    const paymentsAggr = await prisma.payment.groupBy({
      by: ['method'],
      where: { propertyId, createdAt: { gte: startOfDay, lte: endOfDay }, status: 'COMPLETED' },
      _sum: { amount: true }
    });
    
    let cash = 0, card = 0, transfer = 0, other = 0;
    paymentsAggr.forEach(p => {
      const amt = Number(p._sum.amount || 0);
      if (p.method === 'CASH') cash += amt;
      else if (p.method === 'CARD') card += amt;
      else if (p.method === 'BANK_TRANSFER') transfer += amt;
      else other += amt;
    });

    const depositsAggr = await prisma.payment.aggregate({
      where: { propertyId, createdAt: { gte: startOfDay, lte: endOfDay }, status: 'COMPLETED', collectionSource: 'RECEIVABLES' },
      _sum: { amount: true }
    });
    const deposits = Number(depositsAggr._sum.amount || 0);

    const refundsAggr = await prisma.payment.aggregate({
      where: { propertyId, createdAt: { gte: startOfDay, lte: endOfDay }, status: 'REFUNDED' },
      _sum: { amount: true }
    });
    const refunds = Math.abs(Number(refundsAggr._sum.amount || 0));

    const adjustmentsAggr = await prisma.folioItem.aggregate({
      where: { folio: { propertyId }, businessDate, type: 'ADJUSTMENT' },
      _sum: { amount: true }
    });
    const adjustments = Math.abs(Number(adjustmentsAggr._sum.amount || 0));

    // Outstanding balances: sum of all folio balances for checked in guests
    const outstandingAggr = await prisma.folio.aggregate({
      where: { propertyId, reservation: { status: 'CHECKED_IN' } },
      _sum: { balance: true }
    });
    const outstanding = Number(outstandingAggr._sum.balance || 0);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    const report = {
      propertyName: property?.name || 'Property',
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit.status,
      occupancy: {
        available: totalRooms,
        occupied: nightAudit.occupancy ? Math.round((Number(nightAudit.occupancy) / 100) * totalRooms) : 0,
        percentage: Number(nightAudit.occupancy) || 0,
        arrivals,
        departures,
        noShows,
        walkIns
      },
      performance: {
        adr: Number(nightAudit.adr) || 0,
        revpar: Number(nightAudit.revpar) || 0,
      },
      revenue: {
        room: roomRevenue,
        fb: fbRevenue,
        other: otherRevenue,
        gross: grossRevenue,
        discounts: totalDiscounts,
        net: netRevenue,
        taxes: totalTaxes,
        total: totalRevenueWithTax
      },
      financial: {
        cash,
        card,
        transfer,
        other,
        deposits,
        refunds,
        adjustments,
        outstanding
      }
    };

    return successResponse(report);

  } catch (err: any) {
    console.error('[Managers Flash GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

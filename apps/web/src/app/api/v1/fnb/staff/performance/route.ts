import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type RangeKey = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const staffId = req.nextUrl.searchParams.get('staffId');
    const range = (req.nextUrl.searchParams.get('range') || 'DAILY') as RangeKey;
    if (!propertyId || !staffId || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(range)) {
      return errorResponse('VALIDATION_ERROR', 'propertyId, staffId and a valid range are required', 422);
    }

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const endDate = new Date(property.businessDate || new Date());
    endDate.setUTCHours(0, 0, 0, 0);
    const days = range === 'DAILY' ? 1 : range === 'WEEKLY' ? 7 : 30;
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const dateFilter = { gte: startDate, lte: endDate };
    const baseWhere = { propertyId, serverStaffId: staffId, businessDate: dateFilter };

    const [closedStats, allStats, voids, authorizedVoids] = await Promise.all([
      prisma.posOrder.groupBy({ by: ['businessDate'], where: { ...baseWhere, status: 'CLOSED' }, _sum: { total: true, tipAmount: true, guestCount: true }, _count: { id: true } }),
      prisma.posOrder.groupBy({ by: ['businessDate'], where: baseWhere, _count: { id: true } }),
      prisma.posVoid.count({ where: { businessDate: dateFilter, order: { propertyId, serverStaffId: staffId } } }),
      prisma.posVoid.count({ where: { businessDate: dateFilter, authorizerId: staffId, order: { propertyId } } }),
    ]);

    const closedByDate = new Map(closedStats.map((item) => [new Date(item.businessDate).toISOString().slice(0, 10), item]));
    const allByDate = new Map(allStats.map((item) => [new Date(item.businessDate).toISOString().slice(0, 10), item]));
    const trend = [];
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);
      const closed = closedByDate.get(key);
      const all = allByDate.get(key);
      trend.push({
        date: key,
        sales: Number(closed?._sum?.total || 0),
        orders: all?._count?.id || 0,
        closedOrders: closed?._count?.id || 0,
        tips: Number(closed?._sum?.tipAmount || 0),
        covers: Number(closed?._sum?.guestCount || 0),
      });
    }

    const summary = trend.reduce((result, day) => ({
      sales: result.sales + day.sales,
      orders: result.orders + day.orders,
      closedOrders: result.closedOrders + day.closedOrders,
      tips: result.tips + day.tips,
      covers: result.covers + day.covers,
    }), { sales: 0, orders: 0, closedOrders: 0, tips: 0, covers: 0 });

    return successResponse({
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: { ...summary, averageOrderValue: summary.closedOrders ? summary.sales / summary.closedOrders : 0, voidsOnOrders: voids, voidsAuthorized: authorizedVoids },
      trend,
    });
  } catch (error) {
    console.error('[FNB Staff Performance GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error loading staff performance', 500);
  }
}

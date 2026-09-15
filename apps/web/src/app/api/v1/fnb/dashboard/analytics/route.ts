import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    const requestedOutletId = searchParams.get('outletId');
    const range = searchParams.get('range') || 'TODAY'; // TODAY, YESTERDAY, LAST_7, THIS_MONTH, CUSTOM
    const fromDateStr = searchParams.get('from');
    const toDateStr = searchParams.get('to');

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery: string[] = requestedPropertyId ? [requestedPropertyId] : [...allowedPropertyIds];
    const propertyId = propertyIdsToQuery[0]; // Focusing on single property for analytics
    const outletId = requestedOutletId || null;

    // Fetch the property to know the current business date
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { businessDate: true }
    });

    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const bizDate = property.businessDate || new Date();
    
    let startDate = new Date(bizDate);
    let endDate = new Date(bizDate);

    // Business Date filtering logic
    switch (range) {
      case 'YESTERDAY':
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case 'LAST_7':
        startDate.setDate(startDate.getDate() - 6);
        break;
      case 'THIS_MONTH':
        startDate = new Date(bizDate.getFullYear(), bizDate.getMonth(), 1);
        break;
      case 'CUSTOM':
        if (fromDateStr && toDateStr) {
          startDate = new Date(fromDateStr);
          endDate = new Date(toDateStr);
        }
        break;
      case 'TODAY':
      default:
        // Already set
        break;
    }

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    const baseFilter = {
      propertyId,
      ...(outletId ? { outletId } : {}),
      businessDate: dateFilter,
    };

    // --- 1. Order Aggregation (Summary KPIs) ---
    const ordersAgg = await prisma.posOrder.aggregate({
      where: { ...baseFilter, status: { notIn: ['VOIDED', 'CANCELLED'] } },
      _sum: { total: true, subtotal: true, discount: true, taxAmount: true, serviceCharge: true, guestCount: true },
      _count: { id: true }
    });

    const grossRevenue = Number(ordersAgg._sum.total || 0);
    const subtotal = Number(ordersAgg._sum.subtotal || 0);
    const discount = Number(ordersAgg._sum.discount || 0);
    const taxAmount = Number(ordersAgg._sum.taxAmount || 0);
    const serviceCharge = Number(ordersAgg._sum.serviceCharge || 0);

    const netRevenue = subtotal - discount;
    const covers = Number(ordersAgg._sum.guestCount || 0);
    const orders = Number(ordersAgg._count.id || 0);
    const averageCheck = covers > 0 ? grossRevenue / covers : 0;

    // --- 2. Hourly Revenue (Trend) ---
    // In PostgreSQL/Prisma, grouping by date-part is complex. We'll pull raw sums and aggregate in memory.
    const allValidOrders = await prisma.posOrder.findMany({
      where: { ...baseFilter, status: { notIn: ['VOIDED', 'CANCELLED'] } },
      select: { total: true, createdAt: true }
    });
    
    const hourlyRevenueMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyRevenueMap.set(i, 0);

    for (const o of allValidOrders) {
      const hour = new Date(o.createdAt).getHours();
      hourlyRevenueMap.set(hour, (hourlyRevenueMap.get(hour) || 0) + Number(o.total));
    }

    const hourlyRevenue = Array.from(hourlyRevenueMap.entries()).map(([hour, revenue]) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      revenue
    }));

    // --- 3. Category & Top Items & Exceptions ---
    const allValidItems = await prisma.posOrderItem.findMany({
      where: { 
        order: { ...baseFilter, status: { notIn: ['VOIDED', 'CANCELLED'] } },
        voidReason: null 
      },
      select: { 
        productId: true, 
        productName: true,
        quantity: true, 
        total: true,
        product: { select: { category: { select: { fnbClass: true } } } }
      }
    });

    const categoryMap = new Map<string, number>();
    const productStats = new Map<string, { name: string; revenue: number; quantity: number }>();

    for (const item of allValidItems) {
      const fnbClass = item.product?.category?.fnbClass || 'OTHER';
      categoryMap.set(fnbClass, (categoryMap.get(fnbClass) || 0) + Number(item.total));

      const pid = item.productId || item.productName; // Fallback to name if generic
      const existing = productStats.get(pid) || { name: item.productName, revenue: 0, quantity: 0 };
      existing.revenue += Number(item.total);
      existing.quantity += Number(item.quantity);
      productStats.set(pid, existing);
    }

    const categoryRevenue = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    const allProducts = Array.from(productStats.values());
    const topItemsByRevenue = [...allProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const topItemsByQuantity = [...allProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    // --- 4. Outlet Revenue ---
    const outletGroups = await prisma.posOrder.groupBy({
      by: ['outletId'],
      where: { ...baseFilter, status: { notIn: ['VOIDED', 'CANCELLED'] } },
      _sum: { total: true, guestCount: true }
    });

    const outletIds = outletGroups.map(og => og.outletId);
    const outlets = await prisma.posOutlet.findMany({
      where: { id: { in: outletIds } },
      select: { id: true, name: true }
    });
    const outletNameMap = new Map(outlets.map(o => [o.id, o.name]));

    const outletRevenue = outletGroups.map(og => ({
      name: outletNameMap.get(og.outletId) || 'Unknown',
      revenue: Number(og._sum.total || 0),
      covers: Number(og._sum.guestCount || 0)
    })).sort((a, b) => b.revenue - a.revenue);

    // --- 5. Payment Methods ---
    const paymentGroups = await prisma.posPayment.groupBy({
      by: ['method'],
      where: { 
        order: { ...baseFilter },
        status: { in: ['PAID', 'CONFIRMED'] }
      },
      _sum: { amount: true }
    });

    const paymentMethods = paymentGroups.map(pg => ({
      method: pg.method,
      amount: Number(pg._sum.amount || 0)
    })).sort((a, b) => b.amount - a.amount);

    // --- 6. Exceptions (Operational Metrics) ---
    const voidsAgg = await prisma.posOrder.aggregate({
      where: { ...baseFilter, status: { in: ['VOIDED', 'CANCELLED'] } },
      _sum: { subtotal: true },
      _count: { id: true }
    });
    
    const discountsAgg = await prisma.posOrder.aggregate({
      where: { ...baseFilter, status: { notIn: ['VOIDED', 'CANCELLED'] } },
      _sum: { discount: true }
    });

    const refundsAgg = await prisma.posPayment.aggregate({
      where: { order: { ...baseFilter }, status: 'REFUNDED' },
      _sum: { amount: true }
    });

    const unsettledOrders = await prisma.posOrder.count({
      where: { ...baseFilter, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, status: { notIn: ['VOIDED', 'CANCELLED'] } }
    });

    const openSessions = await prisma.posSession.count({
      where: { propertyId, businessDate: dateFilter, status: 'OPEN' }
    });

    return successResponse({
      summary: { 
        grossRevenue,
        netRevenue,
        taxes: taxAmount,
        serviceCharge,
        covers, 
        averageCheck, 
        orders 
      },
      hourlyRevenue,
      categoryRevenue,
      outletRevenue,
      paymentMethods,
      topItems: {
        revenue: topItemsByRevenue,
        quantity: topItemsByQuantity
      },
      operationalMetrics: {
        voids: Number(voidsAgg._sum.subtotal || 0),
        voidCount: Number(voidsAgg._count.id || 0),
        discounts: Number(discountsAgg._sum.discount || 0),
        refunds: Number(refundsAgg._sum.amount || 0),
        unsettledOrders,
        openSessions
      }
    }, 200);

  } catch (err: any) {
    console.error('[FNB Analytics GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating analytics', 500);
  }
}

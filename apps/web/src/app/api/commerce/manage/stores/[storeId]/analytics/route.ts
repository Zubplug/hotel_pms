/**
 * GET /api/commerce/manage/stores/[storeId]/analytics
 *
 * Returns KPI aggregates for the Commerce dashboard overview:
 *  - Total revenue (today, this week, this month)
 *  - Order counts by status
 *  - Top 5 selling products
 *  - Orders by channel (DELIVERY / PICKUP / DINE_IN)
 *  - Hourly order distribution for today
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ storeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId } = await params;

    const store = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true, currency: true },
    });
    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedStatuses = ['DELIVERED', 'READY_FOR_PICKUP'];

    const [
      todayRevenue,
      weekRevenue,
      monthRevenue,
      statusCounts,
      topProducts,
      channelBreakdown,
      liveOrders,
    ] = await Promise.all([
      // Today revenue
      prisma.commerceOrder.aggregate({
        where: { storeId, status: { in: completedStatuses }, createdAt: { gte: todayStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Week revenue
      prisma.commerceOrder.aggregate({
        where: { storeId, status: { in: completedStatuses }, createdAt: { gte: weekStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Month revenue
      prisma.commerceOrder.aggregate({
        where: { storeId, status: { in: completedStatuses }, createdAt: { gte: monthStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Orders by status
      prisma.commerceOrder.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
      // Top 5 products by quantity sold
      prisma.commerceOrderItem.groupBy({
        by: ['productId'],
        where: { order: { storeId, status: { in: completedStatuses } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      // Channel breakdown
      prisma.commerceOrder.groupBy({
        by: ['orderType'],
        where: { storeId, createdAt: { gte: monthStart } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // Live orders (active right now)
      prisma.commerceOrder.findMany({
        where: {
          storeId,
          status: { in: ['AWAITING_RESTAURANT', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] },
        },
        include: {
          customer: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Enrich top products with names
    const productIds = topProducts.map((p) => p.productId);
    const productNames = productIds.length > 0
      ? await prisma.commerceProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, imageUrl: true, price: true },
        })
      : [];
    const productNameMap = Object.fromEntries(productNames.map((p) => [p.id, p]));

    const topProductsEnriched = topProducts.map((p) => ({
      product: productNameMap[p.productId] ?? { id: p.productId, name: 'Unknown' },
      quantitySold: p._sum.quantity ?? 0,
    }));

    return successResponse({
      revenue: {
        today: Number(todayRevenue._sum.totalAmount ?? 0),
        todayOrders: todayRevenue._count,
        week: Number(weekRevenue._sum.totalAmount ?? 0),
        weekOrders: weekRevenue._count,
        month: Number(monthRevenue._sum.totalAmount ?? 0),
        monthOrders: monthRevenue._count,
      },
      currency: store.currency,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      topProducts: topProductsEnriched,
      channelBreakdown: channelBreakdown.map((c) => ({
        channel: c.orderType,
        count: c._count,
        revenue: Number(c._sum.totalAmount ?? 0),
      })),
      liveOrders,
    });
  } catch (err) {
    console.error('[commerce/manage/analytics GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

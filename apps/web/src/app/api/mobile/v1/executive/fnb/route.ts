import { NextRequest } from 'next/server';
import { startOfDay, endOfDay, format, subDays } from 'date-fns';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import {
  getPropertyBusinessDate,
  calculateDailyRevenue,
} from '@/lib/kpi';

export const dynamic = 'force-dynamic';

// ─── Reporting groups for PaymentMethod ──────────────────────────────────────
// Maps all production PaymentMethod values to reporting buckets.
// Mutually exclusive; includes OTHER so totals always reconcile.
function mapPaymentMethod(method: string): string {
  switch (method) {
    case 'CASH':            return 'Cash';
    case 'CARD':
    case 'CARD_OFFLINE':    return 'Card';
    case 'POS':             return 'Card';           // POS terminal = card
    case 'PAYMENT_GATEWAY':
    case 'MOBILE_PAYMENT':  return 'Mobile / Gateway';
    case 'BANK_TRANSFER':   return 'Bank Transfer';
    case 'ROOM_CHARGE':     return 'Room Charge';
    case 'CITY_LEDGER':     return 'City Ledger';
    case 'COMPLIMENTARY':   return 'Complimentary';
    case 'CHEQUE':          return 'Cheque';
    default:                return 'Other';
  }
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const ctx = await requireOrganizationContext(user.id);
    const propertyId = ctx.propertyIds[0];
    if (!propertyId) return errorResponse('FORBIDDEN', 'No property access', 403);

    // ── Business date (authoritative — same semantics as dashboard) ───────────
    const businessDate = await getPropertyBusinessDate(propertyId);

    const prismaModule = await import('@hotel-pms/db');
    const prisma = prismaModule.default;

    // ── F&B Outlets scoped to this property ───────────────────────────────────
    const outlets = await prisma.posOutlet.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, name: true, type: true },
    });
    const outletMap = new Map(outlets.map((o) => [o.id, o]));

    // ── Authoritative Revenue (reuses kpi.ts — no double-counting) ───────────
    // calculateDailyRevenue uses FolioItem as the single source of truth.
    const todayRevenue = await calculateDailyRevenue(propertyId, businessDate);
    const totalFnbRevenue = todayRevenue.fbRevenue + todayRevenue.barRevenue;

    // ── Food / Beverage split within fbRevenue ────────────────────────────────
    // FolioItems (POS/RESTAURANT source) → join PosOrderItem → PosProduct.fnbClass
    // barRevenue is already a separate mutually-exclusive bucket (BAR source)
    const fnbFolioItems = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId },
        businessDate: {
          gte: startOfDay(businessDate),
          lte: endOfDay(businessDate),
        },
        source: { in: ['POS', 'RESTAURANT'] },
        type: { in: ['CHARGE', 'DISCOUNT'] },
        voidedAt: null,
      },
      select: {
        amount: true,
        type: true,
        posTransactionId: true,
      },
    });

    // Collect posOrderIds to fetch product fnbClass
    const posOrderIds = [...new Set(
      fnbFolioItems.map((fi) => fi.posTransactionId).filter(Boolean) as string[]
    )];

    // For each posOrder, get fnbClass of the items (weighted proxy)
    // We aggregate: if order items are mostly BEVERAGE → classify order as BEVERAGE
    const orderFnbClass = new Map<string, 'FOOD' | 'BEVERAGE' | 'OTHER'>();
    if (posOrderIds.length > 0) {
      const orderItems = await prisma.posOrderItem.findMany({
        where: { orderId: { in: posOrderIds }, voidReason: null },
        select: {
          orderId: true,
          unitPrice: true,
          quantity: true,
          product: { select: { category: { select: { fnbClass: true } } } },
        },
      });

      // Group items by orderId and determine dominant fnbClass by revenue
      const orderClassRevenue = new Map<string, { FOOD: number; BEVERAGE: number; OTHER: number }>();
      for (const item of orderItems) {
        const val = Number(item.unitPrice) * Number(item.quantity);
        const cls = (item.product?.category?.fnbClass ?? 'FOOD') as 'FOOD' | 'BEVERAGE' | 'OTHER';
        const existing = orderClassRevenue.get(item.orderId) ?? { FOOD: 0, BEVERAGE: 0, OTHER: 0 };
        existing[cls] += val;
        orderClassRevenue.set(item.orderId, existing);
      }

      for (const [orderId, breakdown] of orderClassRevenue.entries()) {
        const dominant = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0][0];
        orderFnbClass.set(orderId, dominant as 'FOOD' | 'BEVERAGE' | 'OTHER');
      }
    }

    // Split fbRevenue into food vs beverage using FolioItem amounts
    let foodRevenue = 0;
    let beverageRevenue = 0;
    for (const fi of fnbFolioItems) {
      const sign = fi.type === 'CHARGE' ? 1 : -1;
      const amt = Number(fi.amount) * sign;
      const cls = fi.posTransactionId ? (orderFnbClass.get(fi.posTransactionId) ?? 'FOOD') : 'FOOD';
      if (cls === 'BEVERAGE') {
        beverageRevenue += amt;
      } else {
        foodRevenue += amt;
      }
    }

    // Clamp: totals must reconcile with authoritative fbRevenue
    // (floating-point drift guard)
    const fbTotal = todayRevenue.fbRevenue;
    if (Math.abs(foodRevenue + beverageRevenue - fbTotal) > 1) {
      // Normalise proportionally to authoritative total
      const rawTotal = foodRevenue + beverageRevenue;
      if (rawTotal > 0) {
        foodRevenue = (foodRevenue / rawTotal) * fbTotal;
        beverageRevenue = (beverageRevenue / rawTotal) * fbTotal;
      } else {
        foodRevenue = fbTotal;
        beverageRevenue = 0;
      }
    }

    // ── Covers (authoritative — PosOrder.guestCount) ──────────────────────────
    const closedOrderStats = await prisma.posOrder.aggregate({
      where: {
        propertyId,
        businessDate: {
          gte: startOfDay(businessDate),
          lte: endOfDay(businessDate),
        },
        status: { in: ['CLOSED'] },
      },
      _sum: { guestCount: true },
      _count: { id: true },
    });

    const totalCovers = closedOrderStats._sum.guestCount ?? 0;
    const totalOrders = closedOrderStats._count.id ?? 0;
    const avgCheckPerCover = totalCovers > 0 ? totalFnbRevenue / totalCovers : 0;
    const avgCheckPerOrder = totalOrders > 0 ? totalFnbRevenue / totalOrders : 0;

    // ── Outlet Breakdown (FolioItems → PosOrder.outletId) ─────────────────────
    const allFnbFolioItemsWithOutlet = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId },
        businessDate: {
          gte: startOfDay(businessDate),
          lte: endOfDay(businessDate),
        },
        source: { in: ['POS', 'RESTAURANT', 'BAR'] },
        type: { in: ['CHARGE', 'DISCOUNT'] },
        voidedAt: null,
      },
      select: {
        amount: true,
        type: true,
        posTransactionId: true,
      },
    });

    const allOrderIds = [...new Set(
      allFnbFolioItemsWithOutlet.map((fi) => fi.posTransactionId).filter(Boolean) as string[]
    )];

    const ordersWithMeta = allOrderIds.length > 0
      ? await prisma.posOrder.findMany({
          where: { id: { in: allOrderIds } },
          select: {
            id: true,
            outletId: true,
            guestCount: true,
          },
        })
      : [];

    const orderMetaMap = new Map(ordersWithMeta.map((o) => [o.id, o]));

    const outletRevenue = new Map<string, number>();
    const outletCovers = new Map<string, number>();
    const seenOrdersForCovers = new Set<string>();

    for (const fi of allFnbFolioItemsWithOutlet) {
      const sign = fi.type === 'CHARGE' ? 1 : -1;
      const amt = Number(fi.amount) * sign;
      const orderMeta = fi.posTransactionId ? orderMetaMap.get(fi.posTransactionId) : null;
      if (!orderMeta) continue;
      const { outletId, guestCount } = orderMeta;
      outletRevenue.set(outletId, (outletRevenue.get(outletId) ?? 0) + amt);
      if (!seenOrdersForCovers.has(orderMeta.id)) {
        outletCovers.set(outletId, (outletCovers.get(outletId) ?? 0) + (guestCount ?? 1));
        seenOrdersForCovers.add(orderMeta.id);
      }
    }

    // Top item per outlet
    const topItemsByOutlet = new Map<string, { name: string; qty: number; revenue: number }>();
    if (allOrderIds.length > 0) {
      const outletItems = await prisma.posOrderItem.findMany({
        where: {
          orderId: { in: allOrderIds },
          voidReason: null,
        },
        select: {
          orderId: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
        },
      });
      const outletItemRevenue = new Map<string, Map<string, { qty: number; revenue: number }>>();
      for (const item of outletItems) {
        const outletId = orderMetaMap.get(item.orderId)?.outletId;
        if (!outletId) continue;
        const productName = item.product?.name ?? 'Unknown';
        if (!outletItemRevenue.has(outletId)) outletItemRevenue.set(outletId, new Map());
        const existing = outletItemRevenue.get(outletId)!.get(productName) ?? { qty: 0, revenue: 0 };
        existing.qty += Number(item.quantity);
        existing.revenue += Number(item.quantity) * Number(item.unitPrice);
        outletItemRevenue.get(outletId)!.set(productName, existing);
      }
      for (const [outletId, items] of outletItemRevenue.entries()) {
        const top = [...items.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
        if (top) topItemsByOutlet.set(outletId, { name: top[0], qty: top[1].qty, revenue: top[1].revenue });
      }
    }

    const outletBreakdown = outlets.map((outlet) => {
      const rev = outletRevenue.get(outlet.id) ?? 0;
      const covers = outletCovers.get(outlet.id) ?? 0;
      const topItem = topItemsByOutlet.get(outlet.id) ?? null;
      return {
        outletId: outlet.id,
        outletName: outlet.name,
        outletType: outlet.type,
        revenue: rev,
        covers,
        avgCheck: covers > 0 ? rev / covers : 0,
        topItem: topItem ? { name: topItem.name, qty: topItem.qty } : null,
      };
    }).filter((o) => o.revenue > 0 || o.covers > 0);

    // ── Top Selling Items ─────────────────────────────────────────────────────
    const allClosedOrderIds = ordersWithMeta.map((o) => o.id);
    const topItemsRaw = allClosedOrderIds.length > 0
      ? await prisma.posOrderItem.groupBy({
          by: ['productId'],
          where: {
            orderId: { in: allClosedOrderIds },
            voidReason: null,
            productId: { not: null },
          },
          _sum: { quantity: true },
          _count: { id: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10,
        })
      : [];

    const topProductIds = topItemsRaw.map((i) => i.productId).filter(Boolean) as string[];
    const topProducts = topProductIds.length > 0
      ? await prisma.posProduct.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, category: { select: { fnbClass: true } }, price: true },
        })
      : [];

    const topProductMap = new Map(topProducts.map((p) => [p.id, p]));

    // Revenue per product from PosOrderItems (operational, not financial)
    const topItemRevenue: Record<string, number> = {};
    if (allClosedOrderIds.length > 0) {
      const topItemsWithRevenue = await prisma.posOrderItem.findMany({
        where: {
          orderId: { in: allClosedOrderIds },
          voidReason: null,
          productId: { in: topProductIds },
        },
        select: { productId: true, quantity: true, unitPrice: true },
      });
      for (const item of topItemsWithRevenue) {
        if (!item.productId) continue;
        topItemRevenue[item.productId] = (topItemRevenue[item.productId] ?? 0)
          + Number(item.quantity) * Number(item.unitPrice);
      }
    }

    const topSellingItems = topItemsRaw
      .map((row) => {
        const product = topProductMap.get(row.productId!);
        if (!product) return null;
        return {
          productName: product.name,
          fnbClass: product.category?.fnbClass ?? 'FOOD',
          qty: row._sum.quantity ?? 0,
          revenue: topItemRevenue[product.id] ?? 0,
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    // ── Hourly Revenue (PosOrder operational — time-of-day analytics) ─────────
    const ordersForHourly = await prisma.posOrder.findMany({
      where: {
        propertyId,
        businessDate: {
          gte: startOfDay(businessDate),
          lte: endOfDay(businessDate),
        },
        status: 'CLOSED',
      },
      select: { createdAt: true, total: true, guestCount: true },
    });

    const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0, covers: 0 }));
    for (const order of ordersForHourly) {
      const hour = new Date(order.createdAt).getHours();
      hourlyBuckets[hour].revenue += Number(order.total);
      hourlyBuckets[hour].orders += 1;
      hourlyBuckets[hour].covers += order.guestCount ?? 1;
    }
    const hourlyRevenue = hourlyBuckets.filter((h) => h.revenue > 0 || h.orders > 0);

    // ── Payment Breakdown (PosPayment — authoritative settlement data) ────────
    const payments = await prisma.posPayment.findMany({
      where: {
        order: {
          propertyId,
          businessDate: {
            gte: startOfDay(businessDate),
            lte: endOfDay(businessDate),
          },
          status: 'CLOSED',
        },
        status: { in: ['CONFIRMED', 'PAID'] },
      },
      select: { method: true, amount: true },
    });

    const paymentGroups = new Map<string, number>();
    let paymentTotal = 0;
    for (const p of payments) {
      const group = mapPaymentMethod(p.method);
      paymentGroups.set(group, (paymentGroups.get(group) ?? 0) + Number(p.amount));
      paymentTotal += Number(p.amount);
    }

    const paymentBreakdown = [...paymentGroups.entries()]
      .map(([method, amount]) => ({
        method,
        amount,
        pct: paymentTotal > 0 ? Number(((amount / paymentTotal) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ── Voids Summary ─────────────────────────────────────────────────────────
    const voidsSummary = await prisma.posVoid.aggregate({
      where: {
        order: {
          propertyId,
          businessDate: {
            gte: startOfDay(businessDate),
            lte: endOfDay(businessDate),
          },
        },
      },
      _count: { id: true },
    });

    // ── Discounts Summary ─────────────────────────────────────────────────────
    const discountsSummary = await prisma.posDiscount.aggregate({
      where: {
        order: {
          propertyId,
          businessDate: {
            gte: startOfDay(businessDate),
            lte: endOfDay(businessDate),
          },
        },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // ── POS Terminal Status ───────────────────────────────────────────────────
    const terminals = await prisma.posTerminal.findMany({
      where: { propertyId, registrationState: 'REGISTERED' },
      select: { lastSeenAt: true },
    });

    const now = new Date();
    const OFFLINE_MINS = 30;
    let onlineTerminals = 0;
    for (const t of terminals) {
      if (t.lastSeenAt) {
        const diffMins = (now.getTime() - t.lastSeenAt.getTime()) / 60000;
        if (diffMins <= OFFLINE_MINS) onlineTerminals++;
      }
    }

    // ── Active POS Sessions ───────────────────────────────────────────────────
    const activeSessions = await prisma.posSession.count({
      where: { propertyId, status: 'OPEN' },
    });

    // ── 7-Day Revenue Trend (business-date-aware, reuses calculateDailyRevenue) ─
    const trend7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = subDays(businessDate, i);
      const dayRevenue = await calculateDailyRevenue(propertyId, dayDate);
      trend7Days.push({
        date: format(dayDate, 'yyyy-MM-dd'),
        foodRevenue: 0,   // placeholder — food/bev split requires per-day FolioItem analysis
        beverageRevenue: 0,
        barRevenue: dayRevenue.barRevenue,
        fbRevenue: dayRevenue.fbRevenue,
        total: dayRevenue.fbRevenue + dayRevenue.barRevenue,
      });
    }

    // For yesterday trend comparison
    const yesterdayDate = subDays(businessDate, 1);
    const yesterdayRevenue = await calculateDailyRevenue(propertyId, yesterdayDate);
    const yesterdayFnb = yesterdayRevenue.fbRevenue + yesterdayRevenue.barRevenue;
    const revenueTrend = yesterdayFnb > 0
      ? Number((((totalFnbRevenue - yesterdayFnb) / yesterdayFnb) * 100).toFixed(1))
      : totalFnbRevenue > 0 ? 100 : 0;

    // ── Void rate (item-count based — clearly documented) ─────────────────────
    const totalItemsSold = await prisma.posOrderItem.count({
      where: {
        order: {
          propertyId,
          businessDate: {
            gte: startOfDay(businessDate),
            lte: endOfDay(businessDate),
          },
        },
      },
    });
    const voidedItemCount = voidsSummary._count.id ?? 0;
    const voidRate = totalItemsSold > 0
      ? Number(((voidedItemCount / totalItemsSold) * 100).toFixed(1))
      : 0;

    // Discount rate (against totalFnbRevenue gross)
    const totalDiscountAmount = Number(discountsSummary._sum.amount ?? 0);
    const grossBeforeDiscount = totalFnbRevenue + totalDiscountAmount;
    const discountRate = grossBeforeDiscount > 0
      ? Number(((totalDiscountAmount / grossBeforeDiscount) * 100).toFixed(1))
      : 0;

    return successResponse({
      businessDate: format(businessDate, 'yyyy-MM-dd'),

      summary: {
        totalFnbRevenue,
        foodRevenue: Number(foodRevenue.toFixed(2)),
        beverageRevenue: Number(beverageRevenue.toFixed(2)),
        barRevenue: todayRevenue.barRevenue,
        totalCovers,
        avgCheckPerCover: Number(avgCheckPerCover.toFixed(2)),
        totalOrders,
        avgCheckPerOrder: Number(avgCheckPerOrder.toFixed(2)),
        revenueTrend,
        // Void rate = voided items / total items (count-based, documented)
        voidRate,
        // Discount rate = total discounts / gross F&B revenue (before discounts)
        discountRate,
      },

      outletBreakdown,
      topSellingItems,
      hourlyRevenue,
      paymentBreakdown,
      revenueBy7Days: trend7Days,

      posOperations: {
        terminalsOnline: onlineTerminals,
        terminalsTotal: terminals.length,
        activeSessions,
        voids: {
          count: voidedItemCount,
          amount: 0,
        },
        discounts: {
          count: discountsSummary._count.id ?? 0,
          amount: totalDiscountAmount,
        },
      },
    }, 200);

  } catch (err: any) {
    console.error('[Mobile F&B Dashboard API]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to generate F&B analytics', 500);
  }
}

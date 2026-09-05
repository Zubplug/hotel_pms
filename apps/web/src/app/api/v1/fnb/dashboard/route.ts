import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

async function getKpiSummary(propertyIds: string[], outletId: string | null, startOfDay: Date) {
  const baseFilter = {
    propertyId: { in: propertyIds },
    ...(outletId ? { outletId } : {}),
  };

  // Gross Sales from valid payments
  const paymentsAgg = await prisma.posPayment.aggregate({
    where: {
      order: baseFilter,
      createdAt: { gte: startOfDay },
      status: { notIn: ['FAILED', 'REFUNDED'] },
      method: { not: 'COMPLIMENTARY' } // Often excluded from gross sales depending on rules, but let's just do valid payments
    },
    _sum: { amount: true }
  });

  const grossSales = Number(paymentsAgg._sum.amount || 0);

  // Active Orders (Submitted or In Service)
  const activeOrders = await prisma.posOrder.count({
    where: { ...baseFilter, status: { in: ['SUBMITTED', 'IN_SERVICE'] } }
  });

  // Covers (from valid orders today)
  const coversAgg = await prisma.posOrder.aggregate({
    where: {
      ...baseFilter,
      businessDate: startOfDay,
      status: { notIn: ['CANCELLED', 'VOIDED'] }
    },
    _sum: { guestCount: true },
  });
  
  const covers = coversAgg._sum?.guestCount ? Number(coversAgg._sum.guestCount) : 0;

  return {
    grossSales,
    netSales: grossSales,
    activeOrders,
    covers,
    averageCheck: covers > 0 ? (grossSales / covers) : 0,
  };
}

async function getSalesBreakdown(propertyIds: string[], outletId: string | null, startOfDay: Date) {
  const payments = await prisma.posPayment.groupBy({
    by: ['method'],
    where: {
      order: {
        propertyId: { in: propertyIds },
        ...(outletId ? { outletId } : {}),
      },
      createdAt: { gte: startOfDay },
      status: { notIn: ['FAILED', 'REFUNDED'] }
    },
    _sum: { amount: true }
  });

  return payments.map(p => ({
    method: p.method,
    amount: Number(p._sum.amount || 0)
  }));
}

async function getTopSellingItems(propertyIds: string[], outletId: string | null, startOfDay: Date) {
  const items = await prisma.posOrderItem.groupBy({
    by: ['productId', 'productName'],
    where: {
      order: {
        propertyId: { in: propertyIds },
        ...(outletId ? { outletId } : {}),
        businessDate: startOfDay,
        status: { notIn: ['CANCELLED', 'VOIDED'] }
      },
      voidReason: null // exclude voided items
    },
    _sum: {
      quantity: true,
      total: true
    },
    orderBy: {
      _sum: { quantity: 'desc' }
    },
    take: 5
  });

  // We need to fetch the categories for these top products
  const productIds = items.map(i => i.productId).filter(Boolean) as string[];
  const products = await prisma.posProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, category: { select: { name: true } } }
  });
  const categoryMap = new Map(products.map(p => [p.id, p.category.name]));

  return items.map(item => ({
    productId: item.productId,
    productName: item.productName,
    categoryName: item.productId ? (categoryMap.get(item.productId) || 'Uncategorized') : 'Uncategorized',
    quantitySold: Number(item._sum.quantity || 0),
    revenue: Number(item._sum.total || 0)
  }));
}

async function getOperationalAlerts(propertyIds: string[], outletId: string | null, startOfDay: Date) {
  const alerts: any[] = [];

  // 1. Low Stock Alert
  // Assuming a property-wide stock check. 
  // In reality, this should check warehouse visibility, but we'll scope to propertyId for now.
  const lowStockItems = await prisma.stockItem.findMany({
    where: {
      propertyId: { in: propertyIds },
      isActive: true,
      reorderLevel: { not: null }
    }
  });
  
  const lowStock = lowStockItems.filter(item => 
    item.reorderLevel !== null && Number(item.quantityOnHand) <= Number(item.reorderLevel)
  );

  if (lowStock.length > 0) {
    alerts.push({
      type: 'LOW_STOCK',
      severity: 'warning',
      title: 'Low Stock Alert',
      message: `${lowStock.length} items are at or below reorder level. (e.g., ${lowStock[0].name} has ${Number(lowStock[0].quantityOnHand)} left).`
    });
  }

  // 2. Void Anomalies
  // Group voids by authorizerId/staff
  const voidsToday = await prisma.posVoid.groupBy({
    by: ['authorizerId'],
    where: {
      order: {
        propertyId: { in: propertyIds },
        ...(outletId ? { outletId } : {}),
      },
      createdAt: { gte: startOfDay }
    },
    _count: { id: true }
  });

  const voidThreshold = 5; // Configurable threshold
  for (const v of voidsToday) {
    if (v._count.id > voidThreshold) {
      alerts.push({
        type: 'HIGH_VOIDS',
        severity: 'destructive', // maps to red
        title: 'High Void Activity',
        message: `A staff member (ID: ${v.authorizerId || 'Unknown'}) has authorized ${v._count.id} voids today (Threshold: ${voidThreshold}).`
      });
    }
  }

  // 3. KOT Prep Times
  // Since we lack completedAt on PosKot, we calculate active KOT durations
  const activeOrderItems = await prisma.posOrderItem.findMany({
    where: {
      order: {
        propertyId: { in: propertyIds },
        ...(outletId ? { outletId } : {}),
        status: { in: ['IN_SERVICE', 'SUBMITTED'] }
      },
      sentToKitchenAt: { not: null },
      kitchenStatus: { in: ['PENDING', 'PREPARING'] }
    },
    select: { sentToKitchenAt: true, order: { select: { orderNumber: true } } }
  });

  if (activeOrderItems.length > 0) {
    const now = new Date();
    const durations = activeOrderItems.map(item => 
      (now.getTime() - new Date(item.sentToKitchenAt!).getTime()) / 60000
    ).sort((a, b) => a - b);
    
    const maxDuration = Math.max(...durations);
    const medianDuration = durations[Math.floor(durations.length / 2)];
    
    if (maxDuration > 30) {
       alerts.push({
        type: 'SLOW_KOT',
        severity: 'destructive',
        title: 'Severe KOT Delays',
        message: `The longest active kitchen order has been waiting for ${Math.round(maxDuration)} minutes. (Median active: ${Math.round(medianDuration)}m)`
      });
    } else if (maxDuration > 15) {
      alerts.push({
        type: 'SLOW_KOT',
        severity: 'warning', // maps to blue or yellow
        title: 'Slow KOT Processing',
        message: `An active kitchen order has been waiting for ${Math.round(maxDuration)} minutes. (Target: <15m)`
      });
    }
  }

  return alerts;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    const requestedOutletId = searchParams.get('outletId');

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;
    const outletId = requestedOutletId || null;

    const now = new Date();
    // Using simple server timezone date boundary as requested. (Ideally use property timezone config)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [kpis, salesBreakdown, topSellingItems, alerts] = await Promise.all([
      getKpiSummary(propertyIdsToQuery, outletId, startOfDay),
      getSalesBreakdown(propertyIdsToQuery, outletId, startOfDay),
      getTopSellingItems(propertyIdsToQuery, outletId, startOfDay),
      getOperationalAlerts(propertyIdsToQuery, outletId, startOfDay)
    ]);

    return successResponse({
      kpis,
      salesBreakdown,
      topSellingItems,
      alerts
    }, 200);
  } catch (err: any) {
    console.error('[FNB Dashboard GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating dashboard metrics', 500);
  }
}

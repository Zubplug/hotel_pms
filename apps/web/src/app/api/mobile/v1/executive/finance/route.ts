import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { getExecutiveKPISnapshot, getExecutiveRevenueTrend, getPropertyBusinessDate } from '@/lib/kpi';
import { prisma } from '@hotel-pms/db';
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    // Server-side RBAC validation
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Executive access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;

    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    const primaryPropertyId = allowedPropertyIds[0];

    const property = await prisma.property.findUnique({
      where: { id: primaryPropertyId },
      select: { id: true, name: true, timezone: true, baseCurrency: true, settings: true }
    });

    if (!property) {
      return errorResponse('NOT_FOUND', 'Property not found', 404);
    }

    // 1. Business Date
    const businessDate = await getPropertyBusinessDate(primaryPropertyId);

    // 2. Performance & Revenue Mix (Canonical KPI)
    const [snapshot, trend] = await Promise.all([
      getExecutiveKPISnapshot(primaryPropertyId, businessDate),
      getExecutiveRevenueTrend(primaryPropertyId, businessDate, 7)
    ]);

    // 3. Payments Collected Today
    const payments = await prisma.payment.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'COMPLETED',
        createdAt: { // Ideally this maps to businessDate if there's a payment business date field
          gte: startOfDay(businessDate),
          lte: endOfDay(businessDate)
        }
      },
      select: { amount: true, method: true }
    });

    let totalPayments = 0;
    const paymentsByMethod: Record<string, number> = {};
    for (const p of payments) {
      const amt = Number(p.amount);
      totalPayments += amt;
      paymentsByMethod[p.method] = (paymentsByMethod[p.method] || 0) + amt;
    }

    // 4. Outstanding Receivables
    // Sum of balances for all OPEN folios
    const openFolios = await prisma.folio.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'OPEN'
      },
      select: { balance: true }
    });
    
    let totalOutstanding = 0;
    for (const f of openFolios) {
      totalOutstanding += Number(f.balance);
    }

    // 5. Financial Attention
    const attention = [];
    const settings = property.settings as Record<string, any> || {};
    const threshold = settings.financial?.highBalanceThreshold || 150000;

    const highBalanceFolios = await prisma.folio.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'OPEN',
        balance: { gt: threshold }
      },
      select: { balance: true }
    });

    if (highBalanceFolios.length > 0) {
      const totalExposure = highBalanceFolios.reduce((acc: any, f: any) => acc + Number(f.balance), 0);
      attention.push({
        id: `high-balance-${primaryPropertyId}`,
        priority: 'P0',
        category: 'FINANCE',
        title: 'High Guest Balance',
        summary: `${highBalanceFolios.length} in-house accounts above threshold`,
        affectedCount: highBalanceFolios.length,
        totalAmount: totalExposure
      });
    }

    // Check for pending refunds
    const pendingRefunds = await prisma.refund.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'PENDING'
      },
      select: { amount: true }
    });
    
    if (pendingRefunds.length > 0) {
      const totalRefundExposure = pendingRefunds.reduce((acc: any, r: any) => acc + Number(r.amount), 0);
      attention.push({
        id: `pending-refund-${primaryPropertyId}`,
        priority: 'P1',
        category: 'FINANCE',
        title: 'Refund Awaiting Approval',
        summary: `${pendingRefunds.length} refund(s) pending approval`,
        affectedCount: pendingRefunds.length,
        totalAmount: totalRefundExposure
      });
    }

    const now = new Date();

    return successResponse({
      property: {
        id: property.id,
        name: property.name,
        currency: property.baseCurrency,
        timezone: property.timezone
      },
      businessDate: businessDate.toISOString().split('T')[0],
      generatedAt: now.toISOString(),
      
      revenue: {
        posted: snapshot.revenue.totalRevenue,
        changePercent: 0 // Placeholder until period over period comparison is built
      },
      
      payments: {
        total: totalPayments,
        byMethod: Object.entries(paymentsByMethod).map(([method, amount]) => ({ method, amount }))
      },
      
      outstanding: {
        total: totalOutstanding
      },
      
      performance: {
        occupancy: snapshot.occupancyPercent,
        adr: snapshot.adr,
        revpar: snapshot.revpar
      },
      
      revenueMix: {
        accommodation: snapshot.revenue.roomRevenue,
        foodAndBeverage: snapshot.revenue.fbRevenue,
        bar: snapshot.revenue.barRevenue,
        other: snapshot.revenue.otherRevenue
      },
      
      attention,
      
      trend: {
        period: "7_BUSINESS_DAYS",
        days: trend.days
      }
    }, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Finance API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating executive finance dashboard', 500);
  }
}

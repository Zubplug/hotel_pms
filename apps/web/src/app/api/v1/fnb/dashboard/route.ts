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

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const baseFilter = {
      propertyId: { in: propertyIdsToQuery as string[] },
      ...(requestedOutletId ? { outletId: requestedOutletId } : {}),
    };

    // Gross Sales
    const paymentsAgg = await prisma.posPayment.aggregate({
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
          ...(requestedOutletId ? { outletId: requestedOutletId } : {}),
        },
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });

    const grossSales = Number(paymentsAgg._sum.amount || 0);

    // Active Orders
    const activeOrders = await prisma.posOrder.count({
      where: { ...baseFilter, status: { in: ['SUBMITTED', 'IN_SERVICE'] } }
    });

    // Covers
    const coversAgg = await prisma.posOrder.aggregate({
      where: baseFilter,
      _sum: { guestCount: true },
    });
    
    const covers = coversAgg._sum?.guestCount ? Number(coversAgg._sum.guestCount) : 0;

    // Voids
    const voidsCount = await prisma.posVoid.count({
      where: {
        order: baseFilter,
        createdAt: { gte: startOfDay }
      }
    });

    return successResponse({
      kpis: {
        grossSales,
        netSales: grossSales,
        activeOrders,
        covers,
        totalVoids: voidsCount,
        averageCheck: covers > 0 ? (grossSales / covers) : 0,
      }
    }, 200);
  } catch (err: any) {
    console.error('[FNB Dashboard GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating dashboard metrics', 500);
  }
}

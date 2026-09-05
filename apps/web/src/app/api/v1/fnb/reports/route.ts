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
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const paymentsAgg = await prisma.posPayment.groupBy({
      by: ['method'],
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
        },
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });

    const voidsAgg = await prisma.posVoid.aggregate({
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
        },
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });

    const discountsAgg = await prisma.posDiscount.aggregate({
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
        },
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });

    return successResponse({
      reports: {
        tenderBreakdown: paymentsAgg,
        totalVoids: voidsAgg._sum.amount || 0,
        totalDiscounts: discountsAgg._sum.amount || 0,
      }
    }, 200);
  } catch (err: any) {
    console.error('[FNB Reports GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching DSS reports', 500);
  }
}

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
    const property = await prisma.property.findUnique({
      where: { id: propertyIdsToQuery[0] },
      select: { businessDate: true }
    });

    const now = new Date();
    const startOfDay = property?.businessDate || new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const paymentsAgg = await prisma.posPayment.groupBy({
      by: ['method'],
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
          businessDate: startOfDay
        },
        status: { notIn: ['FAILED', 'REFUNDED'] }
      },
      _sum: { amount: true }
    });

    // Subtotal of voided/cancelled orders
    const voidsAgg = await prisma.posOrder.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        businessDate: startOfDay,
        status: { in: ['VOIDED'] }
      },
      _sum: { subtotal: true }
    });
    
    const discountsAgg = await prisma.posOrder.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        businessDate: startOfDay,
        status: { notIn: ['VOIDED'] }
      },
      _sum: { discount: true, subtotal: true }
    });

    return successResponse({
      reports: {
        tenderBreakdown: paymentsAgg,
        totalVoids: voidsAgg._sum?.subtotal || 0,
        totalDiscounts: discountsAgg._sum?.discount || 0,
        grossTotal: discountsAgg._sum?.subtotal || 0
      }
    }, 200);
  } catch (err: any) {
    console.error('[FNB Reports GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching DSS reports', 500);
  }
}

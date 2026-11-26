/**
 * GET /api/commerce/manage/stores/[storeId]/customers
 * Returns paginated customer list with spend and order count.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ storeId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25'));
    const search = url.searchParams.get('q');

    const where = {
      storeId,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.commerceCustomer.findMany({
        where,
        include: {
          _count: { select: { orders: true } },
        },
        orderBy: { totalSpend: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.commerceCustomer.count({ where }),
    ]);

    return paginatedResponse(customers, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[commerce/manage/customers GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

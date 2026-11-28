/**
 * GET   /api/commerce/manage/stores/[storeId]/orders  — paginated order list
 * PATCH /api/commerce/manage/stores/[storeId]/orders/[orderId]/status — update status
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { sendOrderNotification } from '@/lib/commerce/notifications';
import { z } from 'zod';

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
      select: { id: true, notifySmsEnabled: true, notifyEmailEnabled: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25'));
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('paymentStatus');
    const dateFrom = url.searchParams.get('from');
    const dateTo = url.searchParams.get('to');
    const search = url.searchParams.get('q');

    const where = {
      storeId,
      ...(status ? { status: status as string } : {}),
      ...(paymentStatus ? { paymentStatus: paymentStatus as string } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { orderRef: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
          { customer: { phone: { contains: search } } },
        ],
      } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.commerceOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
          payment: { select: { status: true, amount: true, provider: true } },
          delivery: {
            include: {
              driver: { select: { name: true, phone: true, vehicleType: true, vehiclePlate: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.commerceOrder.count({ where }),
    ]);

    return paginatedResponse(orders, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[commerce/manage/orders GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

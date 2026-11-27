import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string }> };

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(100),
  deliveryFee: z.number().min(0),
  estimatedMinutes: z.number().int().min(1).max(1440).nullish(),
  matchKeywords: z.array(z.string().trim().min(2).max(80)).max(30).optional().default([]),
  postalCodes: z.array(z.string().trim().min(2).max(20)).max(30).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

async function authorizedStore(userId: string, storeId: string) {
  const ctx = await requireOrganizationContext(userId);
  await requireFoodCommerceEntitlement(ctx.organizationId);
  return prisma.commerceStore.findFirst({ where: { id: storeId, organizationId: ctx.organizationId }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const { storeId } = await params;
    if (!(await authorizedStore(session.user.id, storeId))) return errorResponse('NOT_FOUND', 'Store not found', 404);
    const zones = await prisma.commerceDeliveryZone.findMany({ where: { storeId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
    return successResponse(zones);
  } catch (error) {
    console.error('[commerce delivery zones GET]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const { storeId } = await params;
    if (!(await authorizedStore(session.user.id, storeId))) return errorResponse('NOT_FOUND', 'Store not found', 404);
    const parsed = zoneSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('VALIDATION_ERROR', 'Invalid delivery area', 422, parsed.error.flatten());
    const zone = await prisma.commerceDeliveryZone.create({ data: { storeId, ...parsed.data } });
    return successResponse(zone, 201);
  } catch (error) {
    console.error('[commerce delivery zones POST]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

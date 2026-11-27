import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string; zoneId: string }> };
const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  deliveryFee: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullish(),
  matchKeywords: z.array(z.string().trim().min(2).max(80)).max(30).optional(),
  postalCodes: z.array(z.string().trim().min(2).max(20)).max(30).optional(),
  isActive: z.boolean().optional(),
});

async function authorizedZone(userId: string, storeId: string, zoneId: string) {
  const ctx = await requireOrganizationContext(userId);
  await requireFoodCommerceEntitlement(ctx.organizationId);
  return prisma.commerceDeliveryZone.findFirst({ where: { id: zoneId, storeId, store: { organizationId: ctx.organizationId } } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const { storeId, zoneId } = await params;
    if (!(await authorizedZone(session.user.id, storeId, zoneId))) return errorResponse('NOT_FOUND', 'Delivery area not found', 404);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('VALIDATION_ERROR', 'Invalid delivery area', 422, parsed.error.flatten());
    return successResponse(await prisma.commerceDeliveryZone.update({ where: { id: zoneId }, data: parsed.data }));
  } catch (error) {
    console.error('[commerce delivery zones PATCH]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const { storeId, zoneId } = await params;
    if (!(await authorizedZone(session.user.id, storeId, zoneId))) return errorResponse('NOT_FOUND', 'Delivery area not found', 404);
    await prisma.commerceDeliveryZone.update({ where: { id: zoneId }, data: { isActive: false } });
    return successResponse({ archived: true });
  } catch (error) {
    console.error('[commerce delivery zones DELETE]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

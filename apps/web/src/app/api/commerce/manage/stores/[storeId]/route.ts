/**
 * GET   /api/commerce/manage/stores/[storeId]  — get store details
 * PATCH /api/commerce/manage/stores/[storeId]  — update store settings
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { encryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string }> };

async function resolveStore(storeId: string, organizationId: string) {
  const store = await prisma.commerceStore.findFirst({
    where: { id: storeId, organizationId },
  });
  return store;
}

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullish(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  preferredGateway: z.enum(['PAYSTACK', 'FLUTTERWAVE']).optional(),
  paystackSecretKey: z.string().optional(),
  flutterwaveSecretKey: z.string().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  minimumOrderAmount: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  notifySmsEnabled: z.boolean().optional(),
  notifyEmailEnabled: z.boolean().optional(),
  targetOutletId: z.string().nullish(),
  logoUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
  primaryColor: z.string().max(20).nullish(),
  operatingHours: z.record(z.string(), z.any()).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const store = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      include: {
        property: { select: { id: true, name: true } },
        deliveryZones: true,
        _count: {
          select: {
            orders: true,
            products: { where: { isActive: true } },
            customers: true,
          },
        },
      },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    // Strip encrypted keys from response
    const { paystackSecretKey, flutterwaveSecretKey, ...safeStore } = store as typeof store & { paystackSecretKey: string | null; flutterwaveSecretKey: string | null };
    return successResponse({
      ...safeStore,
      hasPaystackKey: !!paystackSecretKey,
      hasFlutterwaveKey: !!flutterwaveSecretKey,
    });
  } catch (err) {
    console.error('[commerce/manage/stores/[storeId] GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const store = await resolveStore(storeId, ctx.organizationId);
    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid update data', 422, parsed.error.flatten());
    }
    const data = parsed.data;

    const updateData: Record<string, unknown> = { ...data };

    // Encrypt payment keys if provided
    if (data.paystackSecretKey) {
      updateData.paystackSecretKey = encryptPaymentCredential(data.paystackSecretKey);
    } else {
      delete updateData.paystackSecretKey;
    }
    if (data.flutterwaveSecretKey) {
      updateData.flutterwaveSecretKey = encryptPaymentCredential(data.flutterwaveSecretKey);
    } else {
      delete updateData.flutterwaveSecretKey;
    }

    const updated = await prisma.commerceStore.update({
      where: { id: storeId },
      data: updateData,
    });

    const { paystackSecretKey, flutterwaveSecretKey, ...safe } = updated as typeof updated & { paystackSecretKey: string | null; flutterwaveSecretKey: string | null };
    return successResponse({
      ...safe,
      hasPaystackKey: !!paystackSecretKey,
      hasFlutterwaveKey: !!flutterwaveSecretKey,
    });
  } catch (err) {
    console.error('[commerce/manage/stores/[storeId] PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

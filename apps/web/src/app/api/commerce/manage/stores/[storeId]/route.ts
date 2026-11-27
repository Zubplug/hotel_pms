/**
 * GET   /api/commerce/manage/stores/[storeId]  — get store details
 * PATCH /api/commerce/manage/stores/[storeId]  — update store settings
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireFoodCommerceEntitlement } from '@/lib/commerce/public-access';
import { getPropertyPaymentAccount } from '@/lib/payment-providers/property-account';
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
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  minimumOrderAmount: z.number().min(0).optional(),
  deliveryFeeMode: z.enum(['FLAT', 'ZONE', 'FREE_ABOVE_THRESHOLD']).optional(),
  deliveryFee: z.number().min(0).optional(),
  freeDeliveryAbove: z.number().min(0).nullish(),
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
    await requireFoodCommerceEntitlement(ctx.organizationId);
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

    const paymentAccount = store.propertyId ? await getPropertyPaymentAccount(store.propertyId) : null;
    // Strip legacy encrypted keys from response. New payments use the
    // property's shared BookingPaymentAccount instead.
    const { paystackSecretKey, flutterwaveSecretKey, ...safeStore } = store as typeof store & { paystackSecretKey: string | null; flutterwaveSecretKey: string | null };
    return successResponse({
      ...safeStore,
      hasPaystackKey: paymentAccount?.provider === 'PAYSTACK',
      hasFlutterwaveKey: paymentAccount?.provider === 'FLUTTERWAVE',
      paymentAccountConfigured: Boolean(paymentAccount),
      paymentProvider: paymentAccount?.provider ?? null,
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
    await requireFoodCommerceEntitlement(ctx.organizationId);
    const { storeId } = await params;

    const store = await resolveStore(storeId, ctx.organizationId);
    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid update data', 422, parsed.error.flatten());
    }
    const data = parsed.data;

    // Payment credentials are property-scoped; the store cannot create a
    // second gateway source of truth.
    const updateData: Record<string, unknown> = { ...data };

    const updated = await prisma.commerceStore.update({
      where: { id: storeId },
      data: updateData,
    });

    const paymentAccount = updated.propertyId ? await getPropertyPaymentAccount(updated.propertyId) : null;
    const { paystackSecretKey, flutterwaveSecretKey, ...safe } = updated as typeof updated & { paystackSecretKey: string | null; flutterwaveSecretKey: string | null };
    return successResponse({
      ...safe,
      hasPaystackKey: paymentAccount?.provider === 'PAYSTACK',
      hasFlutterwaveKey: paymentAccount?.provider === 'FLUTTERWAVE',
      paymentAccountConfigured: Boolean(paymentAccount),
      paymentProvider: paymentAccount?.provider ?? null,
    });
  } catch (err) {
    console.error('[commerce/manage/stores/[storeId] PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

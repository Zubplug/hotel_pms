/**
 * GET  /api/commerce/manage/stores  — list all Commerce stores for the org
 * POST /api/commerce/manage/stores  — create a new store
 *
 * Auth: staff session required. Entitlement: ADDON_FOOD_COMMERCE.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { encryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { z } from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  propertyId: z.string(),
  targetOutletId: z.string().optional(),
  description: z.string().max(500).optional(),
  currency: z.string().default('NGN'),
  preferredGateway: z.enum(['PAYSTACK', 'FLUTTERWAVE']).default('PAYSTACK'),
  paystackSecretKey: z.string().optional(),
  flutterwaveSecretKey: z.string().optional(),
  deliveryEnabled: z.boolean().default(false),
  pickupEnabled: z.boolean().default(true),
  minimumOrderAmount: z.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);

    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');

    const stores = await prisma.commerceStore.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        preferredGateway: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        currency: true,
        createdAt: true,
        property: { select: { id: true, name: true } },
        _count: {
          select: {
            orders: { where: { status: { in: ['AWAITING_RESTAURANT', 'ACCEPTED', 'PREPARING'] } } },
            products: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(stores);
  } catch (err) {
    console.error('[commerce/manage/stores GET]', err);
    if (err instanceof Error && err.message.includes('entitlement')) {
      return errorResponse('ENTITLEMENT_REQUIRED', 'Food Commerce add-on is not active.', 403);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);

    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');

    const body = await req.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid store data', 422, parsed.error.flatten());
    }
    const data = parsed.data;

    // Confirm property belongs to this org
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, organizationId: ctx.organizationId },
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    // Check slug uniqueness
    const existing = await prisma.commerceStore.findUnique({ where: { slug: data.slug } });
    if (existing) return errorResponse('CONFLICT', 'A store with this slug already exists', 409);

    // Encrypt payment credentials before storing
    const paystackKey = data.paystackSecretKey
      ? encryptPaymentCredential(data.paystackSecretKey)
      : null;
    const flutterwaveKey = data.flutterwaveSecretKey
      ? encryptPaymentCredential(data.flutterwaveSecretKey)
      : null;

    const store = await prisma.commerceStore.create({
      data: {
        organizationId: ctx.organizationId,
        propertyId: data.propertyId,
        targetOutletId: data.targetOutletId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        currency: data.currency,
        preferredGateway: data.preferredGateway,
        paystackSecretKey: paystackKey,
        flutterwaveSecretKey: flutterwaveKey,
        deliveryEnabled: data.deliveryEnabled,
        pickupEnabled: data.pickupEnabled,
        minimumOrderAmount: data.minimumOrderAmount,
        status: 'DRAFT', // Store starts unpublished; manager activates it manually
      },
    });

    return successResponse(store, 201);
  } catch (err) {
    console.error('[commerce/manage/stores POST]', err);
    if (err instanceof Error && err.message.includes('entitlement')) {
      return errorResponse('ENTITLEMENT_REQUIRED', 'Food Commerce add-on is not active.', 403);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

/**
 * GET  /api/commerce/manage/stores/[storeId]/products  — list all products for a store
 * POST /api/commerce/manage/stores/[storeId]/products  — create product
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { z } from 'zod';

type Params = { params: Promise<{ storeId: string }> };

const modifierOptionSchema = z.object({
  name: z.string().min(1).max(100),
  priceAdjustment: z.number().default(0),
  isDefault: z.boolean().default(false),
});

const modifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(false),
  minSelections: z.number().min(0).default(0),
  maxSelections: z.number().min(1).default(1),
  options: z.array(modifierOptionSchema).min(1),
});

const createProductSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(150),
  description: z.string().max(600).optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
  isAlcohol: z.boolean().default(false),
  calories: z.number().optional(),
  prepTimeMinutes: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const url = new URL(req.url);
    const categoryId = url.searchParams.get('categoryId');
    const isActive = url.searchParams.get('active');

    const products = await prisma.commerceProduct.findMany({
      where: {
        storeId,
        ...(categoryId ? { categoryId } : {}),
        ...(isActive !== null ? { isActive: isActive === 'true' } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return successResponse(products);
  } catch (err) {
    console.error('[commerce/manage/products GET]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Sign in required', 401);
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_FOOD_COMMERCE');
    const { storeId } = await params;

    const storeOk = await prisma.commerceStore.findFirst({
      where: { id: storeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!storeOk) return errorResponse('NOT_FOUND', 'Store not found', 404);

    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid product data', 422, parsed.error.flatten());
    }
    const { modifierGroups, ...productData } = parsed.data;

    // Validate category belongs to this store
    const category = await prisma.commerceCategory.findFirst({
      where: { id: productData.categoryId, storeId },
    });
    if (!category) return errorResponse('NOT_FOUND', 'Category not found in this store', 404);

    const product = await prisma.commerceProduct.create({
      data: {
        storeId,
        categoryId: productData.categoryId,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        compareAtPrice: productData.compareAtPrice,
        imageUrl: productData.imageUrl,
        isAvailable: productData.isAvailable,
        isAlcohol: productData.isAlcohol,
        calories: productData.calories,
        prepTimeMinutes: productData.prepTimeMinutes,
        tags: productData.tags,
        sortOrder: productData.sortOrder,
        isActive: true,
        modifierGroups: modifierGroups.length > 0 ? {
          create: modifierGroups.map((mg, mgIdx) => ({
            name: mg.name,
            required: mg.required,
            minSelections: mg.minSelections,
            maxSelections: mg.maxSelections,
            sortOrder: mgIdx,
            options: {
              create: mg.options.map((opt, optIdx) => ({
                name: opt.name,
                priceAdjustment: opt.priceAdjustment,
                isDefault: opt.isDefault,
                sortOrder: optIdx,
              })),
            },
          })),
        } : undefined,
      },
      include: {
        modifierGroups: { include: { options: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return successResponse(product, 201);
  } catch (err) {
    console.error('[commerce/manage/products POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

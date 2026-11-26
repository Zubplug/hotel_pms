/**
 * GET /api/commerce/storefront/[slug]/menu
 *
 * Public, unauthenticated — returns the full published menu tree:
 * menus → categories → products → modifier groups → options.
 *
 * Used by:
 *   - The embedded ordering widget on any website
 *   - Custom website integrations (LodgeCore PMS sites, standalone sites)
 *   - Third-party front-ends calling the REST API directly
 *
 * Respects time-of-day availability for menus and categories.
 * Never exposes inactive products, categories or menus.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

function isAvailableNow(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return hhmm >= from && hhmm <= to;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: { id: true, status: true, organizationId: true, propertyId: true },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }
    if (store.status !== 'ACTIVE') {
      return errorResponse('STORE_UNAVAILABLE', 'This store is not currently accepting orders.', 503);
    }

    const menus = await prisma.commerceMenu.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    options: {
                      where: { isActive: true },
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Filter menus and categories by time-of-day availability
    const filteredMenus = menus
      .filter((m) => isAvailableNow(m.availableFrom, m.availableTo))
      .map((menu) => ({
        ...menu,
        categories: menu.categories
          .filter((c) => isAvailableNow(c.availableFrom, c.availableTo))
          .map((category) => ({
            ...category,
            // Mask out-of-stock Chef's Specials
            products: category.products.map((p) => ({
              ...p,
              isAvailable:
                p.availableQuantity === null || p.availableQuantity > 0,
            })),
          })),
      }));

    return successResponse(filteredMenus);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

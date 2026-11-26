import { requireEntitlement } from '@/lib/auth/entitlement';

const FOOD_COMMERCE_PRODUCTS = ['ADDON_FOOD_COMMERCE', 'ADDON_FOOD_STANDALONE'] as const;

/**
 * Food Commerce is sold as two packages. The standalone package includes the
 * same operational capabilities, so feature code must not special-case the
 * parent package after entitlement has been granted.
 */
export async function requireFoodCommerceEntitlement(
  organizationId: string,
  propertyId?: string | null,
): Promise<void> {
  let lastError: unknown;

  for (const productCode of FOOD_COMMERCE_PRODUCTS) {
    try {
      await requireEntitlement(organizationId, productCode, propertyId);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Food Commerce entitlement is required');
}

/**
 * Public storefronts still need the organisation's Commerce entitlement.
 * Return a boolean so public routes do not leak subscription details.
 */
export async function hasPublicCommerceAccess(
  organizationId: string,
  propertyId?: string | null,
): Promise<boolean> {
  try {
    await requireFoodCommerceEntitlement(organizationId, propertyId);
    return true;
  } catch {
    return false;
  }
}

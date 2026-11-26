import { requireEntitlement } from '@/lib/auth/entitlement';

/**
 * Public storefronts still need the organisation's Commerce entitlement.
 * Return a boolean so public routes do not leak subscription details.
 */
export async function hasPublicCommerceAccess(
  organizationId: string,
  propertyId?: string | null,
): Promise<boolean> {
  try {
    await requireEntitlement(organizationId, 'ADDON_FOOD_COMMERCE', propertyId);
    return true;
  } catch {
    return false;
  }
}

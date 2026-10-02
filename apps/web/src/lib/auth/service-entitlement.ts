import { hasEntitlement } from '@/lib/auth/entitlement';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function hasPropertyModuleEntitlement(userId: string, propertyId: string, productCode: string) {
  const context = await requireOrganizationContext(userId);
  if (!context.propertyIds.includes(propertyId)) return false;
  return hasEntitlement(context.organizationId, productCode, propertyId);
}

export async function hasAnyPropertyModuleEntitlement(userId: string, propertyIds: readonly string[], productCode: string) {
  const context = await requireOrganizationContext(userId);
  const visiblePropertyIds = propertyIds.filter((propertyId) => context.propertyIds.includes(propertyId));
  return Promise.any(visiblePropertyIds.map((propertyId) => hasEntitlement(context.organizationId, productCode, propertyId)))
    .catch(() => false);
}

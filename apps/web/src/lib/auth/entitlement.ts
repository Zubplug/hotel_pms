import prisma, { getEffectiveLimit as readEffectiveLimit, hasEntitlement as readEntitlement, requireEntitlement as demandEntitlement, requireEntitlementCapacity as demandCapacity, requirePlanLimit as demandPlanLimit } from '@hotel-pms/db';

/**
 * Validates that an organization has an active entitlement for a specific product.
 * Returns true if entitled, false otherwise.
 */
export async function hasEntitlement(organizationId: string, productCode: string, propertyId?: string | null): Promise<boolean> {
  return readEntitlement(prisma, { organizationId, productCode, propertyId });
}

/**
 * Like hasEntitlement, but throws an Error if not entitled.
 * Useful for fast-failing inside server actions or API routes.
 */
export async function requireEntitlement(organizationId: string, productCode: string, propertyId?: string | null): Promise<void> {
  return demandEntitlement(prisma, { organizationId, productCode, propertyId });
}

export async function requireEntitlementCapacity(organizationId: string, productCode: string, propertyId?: string | null, requestedQuantity = 1): Promise<void> {
  return demandCapacity(prisma, { organizationId, productCode, propertyId, requestedQuantity });
}

export async function getEffectiveLimit(organizationId: string, limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations' | 'maxTerminals'): Promise<number | null> {
  return readEffectiveLimit(prisma, { organizationId, limit });
}

export async function requirePlanLimit(organizationId: string, limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations' | 'maxTerminals', currentQuantity: number, requestedQuantity = 1): Promise<void> {
  return demandPlanLimit(prisma, { organizationId, limit, currentQuantity, requestedQuantity });
}

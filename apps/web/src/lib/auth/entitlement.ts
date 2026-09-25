import prisma from '@hotel-pms/db';

/**
 * Validates that an organization has an active entitlement for a specific product.
 * Returns true if entitled, false otherwise.
 */
export async function hasEntitlement(organizationId: string, productCode: string): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      organizationId_productCode: {
        organizationId,
        productCode
      }
    }
  });

  if (!entitlement) return false;
  if (entitlement.status !== 'ACTIVE') return false;
  
  // If there's an explicit expiry and we are past it, deny
  if (entitlement.expiresAt && new Date() > entitlement.expiresAt) return false;

  return true;
}

/**
 * Like hasEntitlement, but throws an Error if not entitled.
 * Useful for fast-failing inside server actions or API routes.
 */
export async function requireEntitlement(organizationId: string, productCode: string): Promise<void> {
  const isEntitled = await hasEntitlement(organizationId, productCode);
  if (!isEntitled) {
    throw new Error(`Payment Required: Your organization does not have an active entitlement for ${productCode}`);
  }
}

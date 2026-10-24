import prisma, { hasEntitlement as hasDatabaseEntitlement } from '@hotel-pms/db';

export async function hasEntitlement(organizationId: string, productCode: string, propertyId?: string | null): Promise<boolean> {
  return hasDatabaseEntitlement(prisma as any, { organizationId, productCode, propertyId });
}

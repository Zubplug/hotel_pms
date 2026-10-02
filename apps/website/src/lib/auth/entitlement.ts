import prisma from '@hotel-pms/db';

export async function hasEntitlement(organizationId: string, productCode: string, propertyId?: string | null): Promise<boolean> {
  const entitlement = await (prisma as any).entitlement.findFirst({
    where: { organizationId, productCode, status: 'ACTIVE', ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}) },
    select: { id: true },
  });
  return Boolean(entitlement);
}

import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { assertPropertyAccess } from '@/lib/property-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { hasPermission } from '@/lib/rbac';

export async function requireModuleAccess(userId: string, productCode: string, propertyId?: string | null) {
  const ctx = await requireOrganizationContext(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isLodgeCoreAdmin: true } });
  if (user?.isLodgeCoreAdmin) return ctx;
  const selectedPropertyId = propertyId ?? ctx.propertyIds[0];
  if (!selectedPropertyId) throw new Error('No property is available for this module');
  await assertPropertyAccess(userId, selectedPropertyId);
  await requireEntitlement(ctx.organizationId, productCode, selectedPropertyId);
  return ctx;
}

/** Shared server-side boundary for APIs and server actions. */
export async function requireAuthorizedModuleAccess(
  userId: string,
  productCode: string,
  propertyId: string,
  permission?: { resource: string; action: string },
) {
  const ctx = await requireModuleAccess(userId, productCode, propertyId);
  if (permission && !(await hasPermission(userId, permission.resource, permission.action, propertyId))) {
    throw new Error(`Forbidden: ${permission.resource}:${permission.action}`);
  }
  return ctx;
}

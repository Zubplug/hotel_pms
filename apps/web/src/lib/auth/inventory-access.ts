import { requireOrganizationContext, type TenantContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';

export async function requireInventoryAccess(userId: string): Promise<TenantContext> {
  const ctx = await requireOrganizationContext(userId);
  const propertyId = ctx.propertyIds[0];
  if (!propertyId) throw new Error('No active property is available');
  await requireEntitlement(ctx.organizationId, 'PROFESSIONAL_OPERATIONS', propertyId);
  return ctx;
}

import { hasEntitlement } from '@/lib/auth/entitlement';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NAVIGATION_MODULES, type NavigationModule } from './navigation-modules';
import prisma from '@hotel-pms/db';

export { NAVIGATION_MODULES } from './navigation-modules';
export type { NavigationModule } from './navigation-modules';

export async function getNavigationModules(userId: string, propertyId?: string | null): Promise<NavigationModule[]> {
  const context = await requireOrganizationContext(userId);
  const selectedPropertyId = propertyId ?? context.propertyIds[0] ?? null;
  if (!selectedPropertyId) return [];

  const results = await Promise.all(
    NAVIGATION_MODULES.map(async (module) => ({
      module,
      enabled: await hasEntitlement(context.organizationId, module, selectedPropertyId),
    })),
  );

  return results.filter((result) => result.enabled).map((result) => result.module);
}

export async function getNavigationLicenseSnapshot(userId: string, propertyId?: string | null) {
  const context = await requireOrganizationContext(userId);
  const selectedPropertyId = propertyId ?? context.propertyIds[0] ?? null;
  const modules = await getNavigationModules(userId, selectedPropertyId);
  if (!selectedPropertyId) {
    return { modules, status: 'UNKNOWN' as const, expiresAt: null, capturedAt: new Date().toISOString() };
  }

  const entitlements = await prisma.entitlement.findMany({
    where: {
      organizationId: context.organizationId,
      OR: [{ propertyId: selectedPropertyId }, { propertyId: null }],
      productCode: { in: modules },
      status: 'ACTIVE',
      startsAt: { lte: new Date() },
    },
    select: { productCode: true, expiresAt: true },
  });
  const pmsEntitlement = entitlements.find((entitlement) => entitlement.productCode === 'MODULE_PMS');
  return {
    modules,
    // Front Desk is a PMS workflow. Optional add-on expiry must remove only
    // that module; it must not keep PMS alive or block PMS access.
    status: pmsEntitlement ? 'ACTIVE' as const : 'EXPIRED' as const,
    expiresAt: pmsEntitlement?.expiresAt?.toISOString() ?? null,
    capturedAt: new Date().toISOString(),
  };
}

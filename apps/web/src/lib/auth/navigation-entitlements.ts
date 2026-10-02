import { hasEntitlement } from '@/lib/auth/entitlement';
import { requireOrganizationContext } from '@/lib/organization-access';

export const NAVIGATION_MODULES = ['MODULE_PMS', 'MODULE_OPERATIONS', 'MODULE_ENTERPRISE'] as const;
export type NavigationModule = (typeof NAVIGATION_MODULES)[number];

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

import { describe, expect, it } from 'vitest';
import { hasEntitlement, requireEntitlementCapacity, subscriptionScope } from '@hotel-pms/db';

describe('billing entitlement isolation', () => {
  it('normalises property scopes and removes duplicates', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(subscriptionScope([id, id, 'not-a-uuid'])).toEqual([id]);
  });

  it('accepts a property-specific entitlement and does not fall back when none exists', async () => {
    const propertyA = '11111111-1111-1111-1111-111111111111';
    const propertyB = '22222222-2222-2222-2222-222222222222';
    const calls: Array<{ where: Record<string, unknown> }> = [];
    const db = {
      entitlement: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          calls.push({ where });
          const conditions = where.AND as Array<Record<string, unknown>> | undefined;
          const scope = conditions?.[0]?.OR as Array<Record<string, unknown>> | undefined;
          const requested = scope?.[0]?.propertyId;
          return requested === propertyA ? { status: 'ACTIVE', startsAt: new Date(0), expiresAt: null, quantity: 10 } : null;
        },
      },
    };

    expect(await hasEntitlement(db, { organizationId: 'org-1', productCode: 'ADDON_SMART_ACCESS', propertyId: propertyA })).toBe(true);
    expect(await hasEntitlement(db, { organizationId: 'org-1', productCode: 'ADDON_SMART_ACCESS', propertyId: propertyB })).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('rejects capacity above the entitlement quantity', async () => {
    const db = {
      entitlement: {
        findFirst: async () => ({ status: 'ACTIVE', startsAt: new Date(0), expiresAt: null, quantity: 30 }),
      },
    };
    await expect(requireEntitlementCapacity(db, { organizationId: 'org-1', productCode: 'MODULE_PMS', propertyId: 'property-1', requestedQuantity: 31 })).rejects.toThrow('Usage limit exceeded');
  });
});

import { describe, expect, it } from 'vitest';
import { assertAuditorAccess, assertCanMutate, isExternalAuditor } from './auditor-utils';

const scope = {
  id: 'access-1', organizationId: 'org-1', propertyId: 'property-a',
  auditPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  auditPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
  accessStartsAt: new Date('2026-01-01T00:00:00.000Z'),
  accessExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
};

describe('external auditor authorization', () => {
  it('allows inclusive period boundaries and rejects adjacent dates', () => {
    expect(() => assertAuditorAccess(scope, 'property-a', new Date('2026-01-01T23:59:00Z'))).not.toThrow();
    expect(() => assertAuditorAccess(scope, 'property-a', new Date('2026-12-31T23:59:00Z'))).not.toThrow();
    expect(() => assertAuditorAccess(scope, 'property-a', new Date('2025-12-31T23:59:00Z'))).toThrow(/outside/);
    expect(() => assertAuditorAccess(scope, 'property-a', new Date('2027-01-01T00:00:00Z'))).toThrow(/outside/);
  });

  it('rejects a different property', () => {
    expect(() => assertAuditorAccess(scope, 'property-b', new Date('2026-06-01T00:00:00Z'))).toThrow(/Property/);
  });

  it('denies mutations while allowing non-auditor sessions', () => {
    expect(isExternalAuditor({ user: { role: 'EXTERNAL_AUDITOR' } })).toBe(true);
    expect(() => assertCanMutate({ user: { role: 'EXTERNAL_AUDITOR' } })).toThrow(/read-only/);
    expect(() => assertCanMutate({ user: { role: 'MANAGER' } })).not.toThrow();
  });
});

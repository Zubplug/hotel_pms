import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../website/src/lib/auth/entitlement', () => ({
  hasEntitlement: vi.fn(async (_organizationId: string, code: string) => code === 'ADDON_CORPORATE_API'),
}));

import {
  CORPORATE_API_SCOPES,
  CorporateApiAuthError,
  assertCorporateApiScope,
  assertCorporateRequestSize,
  consumeCorporateRateLimit,
  issueCorporateApiCredential,
  authenticateCorporateApiRequest,
  parseCorporateBearerToken,
} from '../../../../website/src/lib/corporate-api-auth';
import { hasEntitlement } from '../../../../website/src/lib/auth/entitlement';

describe('corporate API partner security', () => {
  it('parses only bearer tokens with a non-secret prefix', () => {
    expect(parseCorporateBearerToken('Bearer lc_corp_live_abcd.secret')).toEqual({ prefix: 'lc_corp_live_abcd', secret: 'secret' });
    expect(parseCorporateBearerToken('lc_corp_live_abcd.secret')).toBeNull();
    expect(parseCorporateBearerToken('Bearer lc_corp_live_abcd.secret more')).toBeNull();
  });

  it('issues a hash-backed credential and returns the raw token only once', async () => {
    let created: any;
    const db = { apiCredential: { create: vi.fn(async ({ data, select }: any) => {
      created = data;
      return { id: 'credential-1', environment: data.environment, scopes: data.scopes, expiresAt: data.expiresAt };
    }) } };
    const result = await issueCorporateApiCredential(db, {
      partnerId: 'partner-1', environment: 'TEST', scopes: ['quotes:create', 'not-a-scope'],
    });
    expect(result.token).toMatch(/^lc_corp_test_[^.]+\.[^.]+$/);
    expect(created.secretHash).not.toContain(result.token);
    expect(await bcrypt.compare(result.token.split('.')[1], created.secretHash)).toBe(true);
    expect(result.scopes).toEqual(['quotes:create']);
  });

  it('requires both partner and credential scopes', () => {
    const principal: any = { scopes: ['quotes:create'], propertyIds: ['property-1'] };
    expect(() => assertCorporateApiScope(principal, 'quotes:create', 'property-1')).not.toThrow();
    expect(() => assertCorporateApiScope(principal, 'bookings:create')).toThrowError(CorporateApiAuthError);
    expect(() => assertCorporateApiScope(principal, 'quotes:create', 'property-2')).toThrowError('Corporate resource is not available');
    expect(CORPORATE_API_SCOPES).not.toContain('payment:initiate');
  });

  it('enforces request-size and partner-scoped local rate limits', () => {
    expect(() => assertCorporateRequestSize('100', 99)).toThrowError(CorporateApiAuthError);
    expect(() => assertCorporateRequestSize('99', 99)).not.toThrow();
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(consumeCorporateRateLimit(key, 2)).toBe(true);
    expect(consumeCorporateRateLimit(key, 2)).toBe(true);
    expect(consumeCorporateRateLimit(key, 2)).toBe(false);
  });

  it('does not expose partner properties without an active API entitlement', async () => {
    vi.mocked(hasEntitlement).mockImplementation(async (_org, code, propertyId) => code === 'ADDON_CORPORATE_API' && propertyId === 'property-1');
    const secret = 'secret-value';
    const db = {
      apiCredential: {
        findUnique: vi.fn(async () => ({
          id: 'credential-1', secretHash: await bcrypt.hash(secret, 4), environment: 'TEST', scopes: ['properties:read'], status: 'ACTIVE', expiresAt: null, revokedAt: null,
          partner: { id: 'partner-1', organizationId: 'org-1', status: 'ACTIVE', environment: 'TEST', expiresAt: null, scopes: ['properties:read'], rateLimitPerMinute: 10, requestSizeLimitBytes: 1000,
            properties: [
              { propertyId: 'property-1', property: { organizationId: 'org-1', isActive: true, suspendedAt: null } },
              { propertyId: 'property-2', property: { organizationId: 'org-1', isActive: true, suspendedAt: null } },
            ] },
        })),
        update: vi.fn(async () => undefined),
      },
    };
    const principal = await authenticateCorporateApiRequest({ headers: { get: (name: string) => name === 'authorization' ? `Bearer lc_corp_test_prefix.${secret}` : null } }, { requiredEnvironment: 'TEST', db });
    expect(principal.propertyIds).toEqual(['property-1']);
  });
});

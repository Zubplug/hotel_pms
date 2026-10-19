import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { auth, requireOrganizationContext, mockPrisma } = vi.hoisted(() => ({
  auth: vi.fn(),
  requireOrganizationContext: vi.fn(),
  mockPrisma: {
    poolFacility: { findFirst: vi.fn() },
    poolEntry: { findFirst: vi.fn(), findUnique: vi.fn() },
    property: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/organization-access', () => ({ requireOrganizationContext }));
vi.mock('@hotel-pms/db', () => ({ default: mockPrisma, ...mockPrisma }));
vi.mock('@/lib/night-audit-guard', () => ({ isNightAuditTransactionLocked: vi.fn().mockResolvedValue(false) }));

import { POST } from '../app/api/v1/pos/swimming-pool/route';

function request(body: unknown) {
  return { json: async () => body, nextUrl: new URL('https://example.test/api/v1/pos/swimming-pool') } as unknown as NextRequest;
}

describe('Swimming pool operations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'staff-1', propertyId: 'property-1' } });
    requireOrganizationContext.mockResolvedValue({ propertyIds: ['property-1'] });
  });

  it('requires authentication', async () => {
    auth.mockResolvedValue(null);
    const response = await POST(request({ action: 'entry' }));
    expect(response.status).toBe(401);
  });

  it('rejects an admission without an accepted waiver', async () => {
    const response = await POST(request({
      action: 'entry', propertyId: 'property-1', facilityId: 'facility-1', passTypeId: 'pass-1',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('waiver') });
  });

  it('rejects an incident linked to an entry outside the selected facility', async () => {
    mockPrisma.poolFacility.findFirst.mockResolvedValue({ id: 'facility-1' });
    mockPrisma.poolEntry.findFirst.mockResolvedValue(null);
    const response = await POST(request({
      action: 'incident', propertyId: 'property-1', facilityId: 'facility-1', entryId: 'entry-other',
      title: 'Slip', description: 'Guest slipped', severity: 'HIGH',
    }));
    expect(response.status).toBe(404);
  });
});

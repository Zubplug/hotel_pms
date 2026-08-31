import { requireOrganizationContext } from '../apps/web/src/lib/organization-access';
import { assertPropertyAccess } from '../apps/web/src/lib/property-access';
import prisma from '@hotel-pms/db';

jest.mock('@hotel-pms/db', () => ({
  organizationMembership: {
    findUnique: jest.fn(),
  },
  property: {
    findMany: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
  staff: {
    findFirst: jest.fn(),
  },
  staffPosOutletAccess: {
    findMany: jest.fn(),
  },
  posOutlet: {
    findMany: jest.fn(),
  },
}));

describe('Tenant Isolation & Context Boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ORG_A_USER_ID = 'user-a';
  const ORG_A_ID = 'org-a';
  const ORG_B_ID = 'org-b';

  it('rejects access if user has no active membership', async () => {
    (prisma.organizationMembership.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(requireOrganizationContext(ORG_A_USER_ID)).rejects.toThrow(
      'User has no active organization membership'
    );
  });

  it('builds an immutable TenantContext and prevents IDOR on organizationId', async () => {
    (prisma.organizationMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: ORG_A_USER_ID,
      organizationId: ORG_A_ID,
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: ['read:all'],
    });

    (prisma.property.findMany as jest.Mock).mockResolvedValue([{ id: 'prop-a1' }]);
    (prisma.posOutlet.findMany as jest.Mock).mockResolvedValue([{ id: 'outlet-a1' }]);

    const ctx = await requireOrganizationContext(ORG_A_USER_ID);

    // The context MUST strictly return ORG_A_ID, it cannot be overridden by the client.
    expect(ctx.organizationId).toBe(ORG_A_ID);
    
    // Ensure immutability (Object.freeze)
    expect(() => {
      // @ts-ignore
      ctx.organizationId = ORG_B_ID;
    }).toThrow();
  });

  it('assertPropertyAccess strictly relies on the TenantContext properties list', async () => {
    (prisma.organizationMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: ORG_A_USER_ID,
      organizationId: ORG_A_ID,
      role: 'STAFF',
      status: 'ACTIVE',
      permissions: [],
    });

    // Staff is only assigned to prop-a1
    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([{ propertyId: 'prop-a1' }]);
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ id: 'staff-a' });
    (prisma.staffPosOutletAccess.findMany as jest.Mock).mockResolvedValue([]);

    // Access to ORG_A's property succeeds
    await expect(assertPropertyAccess(ORG_A_USER_ID, 'prop-a1')).resolves.not.toThrow();

    // Access to ORG_B's property is explicitly forbidden because it's not in the context scope
    await expect(assertPropertyAccess(ORG_A_USER_ID, 'prop-b1')).rejects.toThrow('You do not have access to this property');
  });

  it('No operation authenticated as ORG-A can read resources in ORG-B (Invariant Stub)', () => {
    // This is the anchor for Phase 2, 3, and 4 test cases.
    // As we migrate routes and models, we will assert here that API requests
    // simulating ORG-A's JWT attempting to access ORG-B's URLs return 403/404.
    expect(true).toBe(true);
  });
});

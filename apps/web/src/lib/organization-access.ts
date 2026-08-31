import prisma from '@hotel-pms/db';

export type TenantContext = Readonly<{
  organizationId: string;
  userId: string;
  role: string;
  permissions: readonly string[];
  propertyIds: readonly string[];
  outletIds: readonly string[];
}>;

export async function requireOrganizationContext(userId: string): Promise<TenantContext> {
  // 1. Resolve strict organization membership
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('User has no active organization membership');
  }

  // 2. Resolve Property Scope
  // If the user is an org-level admin (e.g., 'ADMIN' or 'SUPER_ADMIN'), they get all properties in the org.
  // Otherwise, we derive from UserRole.
  let propertyIds: string[] = [];
  if (['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(membership.role)) {
    const orgProps = await prisma.property.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true },
    });
    propertyIds = orgProps.map((p: any) => p.id);
  } else {
    const userRoles = await prisma.userRole.findMany({
      where: { userId, propertyId: { not: null } },
      select: { propertyId: true },
    });
    propertyIds = userRoles.map((r: any) => r.propertyId as string);
  }

  // 3. Resolve Outlet Scope
  // If org admin, they get all outlets in the org.
  // Otherwise, derived from StaffPosOutletAccess.
  let outletIds: string[] = [];
  if (['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(membership.role)) {
    const orgOutlets = await prisma.posOutlet.findMany({
      where: { property: { organizationId: membership.organizationId } },
      select: { id: true },
    });
    outletIds = orgOutlets.map((o: any) => o.id);
  } else {
    // Find staff record
    const staff = await prisma.staff.findFirst({
      where: { userId, organizationId: membership.organizationId },
    });
    if (staff) {
      const accesses = await prisma.staffPosOutletAccess.findMany({
        where: { staffId: staff.id },
        select: { outletId: true },
      });
      outletIds = accesses.map((a: any) => a.outletId);
    }
  }

  const context: TenantContext = Object.freeze({
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    permissions: Object.freeze([...membership.permissions]),
    propertyIds: Object.freeze(propertyIds),
    outletIds: Object.freeze(outletIds),
  });

  return context;
}

export async function getUserOrganizationId(userId: string): Promise<string> {
  const ctx = await requireOrganizationContext(userId);
  return ctx.organizationId;
}

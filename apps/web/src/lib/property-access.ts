import prisma from '@hotel-pms/db';

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
  constructor(message = 'You do not have access to this property') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Asserts that the given userId has access to the given propertyId.
 * Super admins bypass all checks.
 * Throws ForbiddenError if access is denied.
 */
export async function assertPropertyAccess(
  userId: string,
  propertyId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });

  if (!user) throw new ForbiddenError('User not found');
  if (user.isSuperAdmin) return; // super admins access everything

  const [staff, userRoles] = await Promise.all([
    prisma.staff.findFirst({ where: { userId }, select: { propertyAccess: true } }),
    prisma.userRole.findMany({ where: { userId }, select: { propertyId: true, role: { select: { organizationId: true } } } }),
  ]);

  const rolePropertyIds = userRoles.filter(role => role.propertyId).map(role => role.propertyId as string);
  const organizationIds = Array.from(new Set(userRoles.filter(role => !role.propertyId).map(role => role.role.organizationId)));
  const organizationPropertyIds = organizationIds.length
    ? (await prisma.property.findMany({ where: { organizationId: { in: organizationIds } }, select: { id: true } })).map(property => property.id)
    : [];
  const hasAccess = [...(staff?.propertyAccess ?? []), ...rolePropertyIds, ...organizationPropertyIds].includes(propertyId);
  if (!hasAccess) throw new ForbiddenError();
}

/**
 * Returns the list of property IDs the user can access.
 * Super admins get all properties in the org.
 */
export async function getUserPropertyIds(
  userId: string,
  organizationId?: string
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, roles: { select: { propertyId: true, role: { select: { organizationId: true } } } } },
  });

  if (!user) return [];

  if (user.isSuperAdmin) {
    const properties = await prisma.property.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: { id: true },
    });
    return properties.map((p: any) => p.id);
  }

  const staff = await prisma.staff.findFirst({
    where: { userId },
    select: { propertyAccess: true },
  });
  const directPropertyIds = user.roles.filter(role => role.propertyId).map(role => role.propertyId as string);
  const organizationIds = Array.from(new Set(user.roles.filter(role => !role.propertyId).map(role => role.role.organizationId)));
  const organizationPropertyIds = organizationIds.length
    ? (await prisma.property.findMany({ where: { organizationId: { in: organizationIds } }, select: { id: true } })).map(property => property.id)
    : [];
  return Array.from(new Set([...(staff?.propertyAccess ?? []), ...directPropertyIds, ...organizationPropertyIds]));
}

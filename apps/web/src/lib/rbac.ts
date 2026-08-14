import prisma from '@hotel-pms/db';

export async function hasPermission(
  userId: string,
  resource: string,
  action: string,
  propertyId?: string
): Promise<boolean> {
  // First, get the user to check if they are SuperAdmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });

  if (!user) return false;
  if (user.isSuperAdmin) return true;

  // Retrieve user roles that are either global (propertyId is null) or specific to the requested property
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ propertyId: null }, ...(propertyId ? [{ propertyId }] : [])],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission.resource === resource && rp.permission.action === action) {
        return true;
      }
      if (rp.permission.resource === '*' && rp.permission.action === '*') {
        return true;
      }
    }
  }

  return false;
}

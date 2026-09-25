import prisma from '@hotel-pms/db';

export async function hasPermission(userId: string, propertyId: string, requiredPermission: string): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, propertyId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  });

  for (const ur of userRoles) {
    if (ur.role.permissions.some(p => p.permission.name === requiredPermission)) {
      return true;
    }
  }

  // Admin and Super Admin org-level check
  const membership = await prisma.organizationMembership.findUnique({ where: { userId } });
  const property = await prisma.property.findFirst({ where: { id: propertyId }, select: { organizationId: true } });
  if (!property || !membership || property.organizationId !== membership.organizationId) return false;
  if (membership && ['ADMIN', 'SUPER_ADMIN'].includes(membership.role)) {
     // System Admins have 'corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:view_city_ledger' 
     // but not change_credit_limit or change_deposit_policy (unless explicitly authorized, which we manage via explicit role assignments).
     if (['corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:view_city_ledger', 'rate_plan:create', 'rate_plan:edit'].includes(requiredPermission)) {
        return true;
     }
     
     if (membership.role === 'SUPER_ADMIN') return true; // Super admins can do anything
  }

  return false;
}

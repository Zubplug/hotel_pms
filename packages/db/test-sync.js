const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const staffList = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id:              true,
        firstName:       true,
        lastName:        true,
        department:      true,
        position:        true,
        posPinHash:      true,
        posTokenVersion: true,
        isActive:        true,
        userId: true,
      }
    });

    const staffWithPermissions = await Promise.all(
      staffList.map(async (staff) => {
        let permissions = [];
        let roleName = '';
        let hasPosAccess = false;

        if (staff.userId) {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: staff.userId,
              OR: [
                { propertyId },
                { propertyId: null }
              ]
            },
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

          permissions = Array.from(new Set(
            userRoles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
          ));

          roleName = userRoles[0]?.role?.name ?? staff.position;

          hasPosAccess = permissions.some(p =>
            p === 'ACCESS_POS' ||
            p === 'ACCESS_FRONT_DESK' ||
            p === 'ACCESS_CASH_MANAGEMENT' ||
            p === 'USE_EMERGENCY_CASHIER' ||
            p.startsWith('ACCESS_KEYCARD')
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            (staff.position || '').toUpperCase()
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            (roleName || '').toUpperCase()
          );
        }

        return {
          id: staff.id,
          firstName: staff.firstName,
          position: staff.position,
          roleName,
          permissions,
          hasPosAccess
        };
      })
    );

    console.log(JSON.stringify(staffWithPermissions, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

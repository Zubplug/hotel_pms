const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const propertyId = (await prisma.property.findFirst()).id;
  const staffList = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        position: true,
        userId: true,
      }
    });

  for (const staff of staffList) {
    let permissions = [];
    let roleName = '';
    let hasPosAccess = false;
    
    if (staff.userId) {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: staff.userId,
              OR: [
                { propertyId },
                { propertyId: null } // org-wide roles
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
            userRoles.flatMap(ur =>
              ur.role.permissions.map(rp => rp.permission.name)
            )
          ));

          roleName = userRoles[0]?.role?.name ?? staff.position;

          hasPosAccess = permissions.some(p =>
            p === 'ACCESS_POS' ||
            p === 'ACCESS_FRONT_DESK' ||
            p === 'ACCESS_CASH_MANAGEMENT' ||
            p === 'USE_EMERGENCY_CASHIER' ||
            p.startsWith('ACCESS_KEYCARD')
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            staff.position?.toUpperCase()
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            roleName?.toUpperCase()
          );
        }
        
    console.log(`${staff.firstName} (${staff.position} / ${roleName}): hasPosAccess=${hasPosAccess}, perms=${permissions.length}`);
  }
}
check().finally(() => prisma.$disconnect());

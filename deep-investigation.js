const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const devices = await prisma.posDevice.findMany({
      where: { status: 'ACTIVE' },
      take: 1
    });
    
    if (!devices.length) {
      console.log("NO ACTIVE DEVICES FOUND IN DB.");
      return;
    }
    const device = devices[0];
    console.log("Found active device:", device.id, "Property ID:", device.propertyId);

    const propertyId = device.propertyId;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { settings: true, isActive: true }
    });

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
        posPinHash: true,
        isActive: true,
      }
    });

    console.log(`Found ${staffList.length} active staff members with access to property ${propertyId}.`);

    const staffWithPermissions = await Promise.all(
      staffList.map(async (staff) => {
        let permissions = [];
        let roleName = '';
        let hasPosAccess = false;

        if (staff.userId) {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: staff.userId,
              OR: [ { propertyId }, { propertyId: null } ]
            },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
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
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            staff.position?.toUpperCase()
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            roleName?.toUpperCase()
          );
        }

        return {
          id: staff.id,
          name: staff.firstName,
          position: staff.position,
          role: roleName,
          hasPosAccess,
          pinHashLength: staff.posPinHash ? staff.posPinHash.length : 0
        };
      })
    );

    console.log("Processed Staff Output:");
    console.table(staffWithPermissions);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
run();

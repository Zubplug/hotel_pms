const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const adminStaff = await prisma.staff.findFirst({ where: { firstName: 'Admin' } });
  const adminUser = await prisma.user.findUnique({ where: { id: adminStaff.userId } });
  const userRoles = await prisma.userRole.findMany({ where: { userId: adminUser.id }, include: { role: true } });
  
  console.log("Admin has roles:");
  userRoles.forEach(ur => console.log(`- ${ur.role.name}`));
  
  // Give 'General Manager' role some basic POS permissions so they show up.
  const posPerm = await prisma.permission.findFirst({ where: { name: 'ACCESS_POS' } });
  const frontDeskPerm = await prisma.permission.findFirst({ where: { name: 'ACCESS_FRONT_DESK' } });
  
  for (const ur of userRoles) {
    if (ur.role.name === 'General Manager') {
       await prisma.rolePermission.createMany({
         data: [
           { roleId: ur.role.id, permissionId: posPerm.id },
           { roleId: ur.role.id, permissionId: frontDeskPerm.id }
         ],
         skipDuplicates: true
       });
       console.log("Added ACCESS_POS and ACCESS_FRONT_DESK to General Manager role.");
    }
  }
}
fix().finally(() => prisma.$disconnect());

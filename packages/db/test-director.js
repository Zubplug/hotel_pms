const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "director@lodgecore.com" },
    select: { id: true, isSuperAdmin: true }
  });
  console.log("Director:", user);
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  });
  
  let hasPerm = false;
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission.resource === "room" && rp.permission.action === "change_status") {
        hasPerm = true;
      }
    }
  }
  console.log("Director HasPerm:", hasPerm);
}
main().catch(console.error).finally(() => prisma.$disconnect());

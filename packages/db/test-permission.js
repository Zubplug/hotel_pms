const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const userId = "05b8249d-fed4-43e8-9c69-521945ae8f05"; // receptionist
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const resource = "room";
  const action = "change_status";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  console.log("SuperAdmin:", user.isSuperAdmin);

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

  let hasPerm = false;
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission.resource === resource && rp.permission.action === action) {
        hasPerm = true;
      }
      if (rp.permission.resource === '*' && rp.permission.action === '*') {
        hasPerm = true;
      }
    }
  }
  console.log("HasPerm:", hasPerm);
}
main().catch(console.error).finally(() => prisma.$disconnect());

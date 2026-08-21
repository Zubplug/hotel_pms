const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, isSuperAdmin: true } });
  console.log("Users:", users);
  const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } } });
  console.log("Roles:", JSON.stringify(roles, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

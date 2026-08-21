const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const roles = await prisma.role.findMany({ select: { id: true, name: true, isSystem: true, organizationId: true } });
  console.log(JSON.stringify(roles, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());

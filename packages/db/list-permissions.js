const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const permissions = await prisma.permission.findMany();
  console.log(permissions.map(p => p.name).sort());
}
main().finally(() => prisma.$disconnect());

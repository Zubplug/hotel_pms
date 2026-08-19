const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.userRole.findMany({
    where: { role: { name: { in: ['Executive', 'Manager', 'General Manager'] } } },
    include: { role: true, user: true }
  });
  console.log(`Found ${roles.length} managers/executives`);
}
main().catch(console.error).finally(() => prisma.$disconnect());

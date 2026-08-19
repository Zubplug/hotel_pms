const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const targetRoles = ['Executive', 'Manager', 'General Manager', 'DIRECTOR'];
  const userRoles = await prisma.userRole.findMany({
    where: {
      role: {
        name: { in: targetRoles },
      }
    },
    include: { role: true, user: true, property: true }
  });
  console.log(`Found ${userRoles.length} user roles matching target roles.`);
  console.log(JSON.stringify(userRoles, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

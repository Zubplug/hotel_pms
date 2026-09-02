const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const stf = await prisma.staff.findMany({
    where: { firstName: { in: ['Esther', 'Friday', 'Ogechi'] } },
    include: { outletAccess: true }
  });
  console.log(JSON.stringify(stf, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  console.log("Testing basic query");
  const org = await prisma.organization.findFirst({ where: { slug: 'lodgecore' } });
  console.log("Org:", org);
}
run().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const property = await prisma.property.findFirst();
  console.log(property.id);
}
run().finally(() => prisma.$disconnect());

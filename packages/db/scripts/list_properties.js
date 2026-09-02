const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const properties = await prisma.property.findMany();
  properties.forEach(p => console.log(p.name));
}
main().catch(console.error).finally(() => prisma.$disconnect());

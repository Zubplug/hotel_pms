const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const properties = await prisma.property.findMany();
  console.log("All properties:");
  properties.forEach(p => console.log(p.name, p.id));
}

main().catch(console.error).finally(() => prisma.$disconnect());

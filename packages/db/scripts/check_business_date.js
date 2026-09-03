const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  console.log(`Property: ${property.name}`);
  console.log(`Business Date: ${property.businessDate}`);
  console.log(`Audit Status: ${property.auditStatus}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

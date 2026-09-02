const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const poolBar = await prisma.posOutlet.findFirst({ where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - POOL BAR' } });
  console.log(`Outlet ID: ${poolBar.id}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());

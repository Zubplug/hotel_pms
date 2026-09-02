const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const outlets = await prisma.posOutlet.findMany({ where: { propertyId: property.id } });
  outlets.forEach(o => console.log(o.name));
}
main().catch(console.error).finally(() => prisma.$disconnect());

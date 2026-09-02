const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  await prisma.staff.updateMany({
    where: { email: { in: ['fridayekunke@gmail.com', 'ogechinweke@gmail.com'] } },
    data: { organizationId: property.organizationId }
  });
  
  console.log(`Updated organizationId to ${property.organizationId}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());

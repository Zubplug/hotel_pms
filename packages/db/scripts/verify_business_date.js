const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  console.log(`Property:      ${property.name}`);
  console.log(`Business Date: ${property.businessDate.toDateString()}`);
  console.log(`Audit Status:  ${property.auditStatus}`);
  console.log(`Updated At:    ${property.updatedAt}`);

  // Count remaining audits
  const auditCount = await prisma.nightAudit.count({ where: { propertyId: property.id } });
  console.log(`Night Audit records remaining: ${auditCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

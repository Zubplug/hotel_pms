const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  const recentAudits = await prisma.nightAudit.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: 'desc' },
      take: 5
  });

  if (recentAudits.length === 0) {
      console.log("No night audits found for this property.");
  } else {
      for (const audit of recentAudits) {
          console.log(`Audit ID: ${audit.id} | Business Date: ${audit.businessDate} | Status: ${audit.status} | Created: ${audit.createdAt}`);
      }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@hotel-pms/db');
const prisma = new PrismaClient();
async function run() {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { 
      OR: [
        { name: { contains: 'comp', mode: 'insensitive' } },
        { name: { contains: 'allowance', mode: 'insensitive' } }
      ]
    },
    select: { id: true, propertyId: true, code: true, name: true, type: true }
  });
  console.log("Complimentary / Allowance Accounts:");
  console.dir(accounts, { depth: null });
  
  const properties = await prisma.property.findMany({
    select: { id: true, name: true, settings: true }
  });
  console.log("\nProperty Settings (contraRevenueAccounts):");
  properties.forEach(p => {
    console.log(`Property ${p.name} (${p.id}):`);
    const settings = p.settings || {};
    console.dir(settings?.accountingConfig?.contraRevenueAccounts, { depth: null });
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());

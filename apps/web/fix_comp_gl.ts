const { PrismaClient } = require('@hotel-pms/db');
const prisma = new PrismaClient();

async function run() {
  const properties = await prisma.property.findMany();
  
  for (const property of properties) {
    // Make sure 4900 exists
    const account = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: '4900' }
    });
    
    if (account) {
      const settings = property.settings || {};
      settings.accountingConfig = settings.accountingConfig || {};
      settings.accountingConfig.contraRevenueAccounts = settings.accountingConfig.contraRevenueAccounts || {};
      
      settings.accountingConfig.contraRevenueAccounts.COMPLIMENTARY = '4900';
      await prisma.property.update({
        where: { id: property.id },
        data: { settings }
      });
      console.log(`Updated settings for property ${property.name} to map COMPLIMENTARY to 4900 (${account.name})`);
    } else {
      console.log(`Property ${property.name} does not have account 4900.`);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());

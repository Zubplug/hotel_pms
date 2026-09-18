import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Laundry Revenue (4300) into Chart of Accounts...');

  const properties = await prisma.property.findMany();

  for (const property of properties) {
    const existing = await prisma.chartOfAccount.findFirst({
      where: {
        propertyId: property.id,
        code: '4300'
      }
    });

    if (!existing) {
      const glAccount = await prisma.chartOfAccount.create({
        data: {
          propertyId: property.id,
          name: 'Laundry Revenue',
          code: '4300',
          type: 'REVENUE',
          normalBalance: 'CREDIT',
          category: 'OPERATING_REVENUE',
          isActive: true,
          description: 'Revenue from laundry and dry cleaning services'
        }
      });
      console.log(`Created Laundry Revenue (4300) for property ${property.id}: ${glAccount.id}`);
    } else {
      console.log(`Laundry Revenue (4300) already exists for property ${property.id}`);
    }

    // Now update the GL mappings in property settings if it's not set
    const settings = (property.settings as any) || {};
    if (!settings.accountingConfig) {
      settings.accountingConfig = {};
    }
    if (!settings.accountingConfig.revenueAccounts) {
      settings.accountingConfig.revenueAccounts = {};
    }

    if (!settings.accountingConfig.revenueAccounts.LAUNDRY) {
      settings.accountingConfig.revenueAccounts.LAUNDRY = '4300';
      await prisma.property.update({
        where: { id: property.id },
        data: { settings }
      });
      console.log(`Updated LAUNDRY revenue GL mapping to '4300' for property ${property.id}`);
    }
  }

  console.log('Finished seeding Laundry Revenue accounts.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

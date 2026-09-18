import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Contra-Revenue Accounts into Chart of Accounts on Production DB...');

  const properties = await prisma.property.findMany();

  for (const property of properties) {
    console.log(`Processing property ${property.name} (${property.id})`);

    // 1. Seed 4900 - Allowances and Discounts
    let discountCode = '4900';
    const existing4900 = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: '4900' }
    });

    if (existing4900 && !existing4900.name.toLowerCase().includes('discount')) {
      discountCode = '4910';
      console.log(`Code 4900 taken by ${existing4900.name}, using ${discountCode}`);
    }

    let existingDiscount = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: discountCode }
    });

    if (!existingDiscount) {
      existingDiscount = await prisma.chartOfAccount.create({
        data: {
          propertyId: property.id,
          name: 'Allowances and Discounts',
          code: discountCode,
          type: 'REVENUE',
          normalBalance: 'DEBIT', // Contra-revenue has a normal debit balance
          category: 'CONTRA_REVENUE',
          isActive: true,
          description: 'Contra-revenue account for guest discounts and allowances'
        }
      });
      console.log(`Created ${discountCode} - Allowances and Discounts`);
    }

    // 2. Seed 4950 - Complimentary Allowance
    let compCode = '4950';
    const existing4950 = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: '4950' }
    });

    if (existing4950 && !existing4950.name.toLowerCase().includes('complimentary')) {
      compCode = '4960';
      console.log(`Code 4950 taken by ${existing4950.name}, using ${compCode}`);
    }

    let existingComp = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: compCode }
    });

    if (!existingComp) {
      existingComp = await prisma.chartOfAccount.create({
        data: {
          propertyId: property.id,
          name: 'Complimentary Allowance',
          code: compCode,
          type: 'REVENUE',
          normalBalance: 'DEBIT', // Contra-revenue has a normal debit balance
          category: 'CONTRA_REVENUE',
          isActive: true,
          description: 'Contra-revenue account for complimentary services provided'
        }
      });
      console.log(`Created ${compCode} - Complimentary Allowance`);
    }

    // 3. Update Property Settings
    const settings = (property.settings as any) || {};
    if (!settings.accountingConfig) settings.accountingConfig = {};
    if (!settings.accountingConfig.contraRevenueAccounts) settings.accountingConfig.contraRevenueAccounts = {};

    settings.accountingConfig.contraRevenueAccounts.DISCOUNT = discountCode;
    settings.accountingConfig.contraRevenueAccounts.COMPLIMENTARY = compCode;

    await prisma.property.update({
      where: { id: property.id },
      data: { settings }
    });
    console.log(`Mapped DISCOUNT to ${discountCode} and COMPLIMENTARY to ${compCode} for ${property.name}`);
  }

  console.log('Finished seeding Contra-Revenue accounts.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

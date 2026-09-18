import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Laundry Revenue into Chart of Accounts on Production DB...');

  const properties = await prisma.property.findMany();

  for (const property of properties) {
    // Prefer an existing Laundry account wherever the property has already
    // established its own chart numbering. This prevents a property with
    // Laundry at 4200 and Events at 4300 from being remapped to a duplicate.
    const existingLaundryByName = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, type: 'REVENUE', name: { contains: 'laundry', mode: 'insensitive' } },
      orderBy: { code: 'asc' },
    });
    const existing4300 = await prisma.chartOfAccount.findFirst({
      where: { propertyId: property.id, code: '4300' }
    });

    let targetCode = existingLaundryByName?.code || '4300';
    let accountId = '';

    if (!existingLaundryByName && existing4300 && !existing4300.name.toLowerCase().includes('laundry')) {
      console.log(`Code 4300 is taken by "${existing4300.name}" in ${property.name}. Using fallback code 4350.`);
      targetCode = '4350';
    }

    const existingLaundry = existingLaundryByName || await prisma.chartOfAccount.findFirst({ where: { propertyId: property.id, code: targetCode } });

    if (!existingLaundry) {
      const glAccount = await prisma.chartOfAccount.create({
        data: {
          propertyId: property.id,
          name: 'Laundry Revenue',
          code: targetCode,
          type: 'REVENUE',
          normalBalance: 'CREDIT',
          category: 'OPERATING_REVENUE',
          isActive: true,
          description: 'Revenue from laundry and dry cleaning services'
        }
      });
      accountId = glAccount.id;
      console.log(`Created Laundry Revenue (${targetCode}) for property ${property.name}: ${glAccount.id}`);
    } else {
      accountId = existingLaundry.id;
      console.log(`Laundry Revenue (${targetCode}) already exists for property ${property.name}`);
    }

    // Now update the GL mappings in property settings if it's not set
    const settings = (property.settings as any) || {};
    if (!settings.accountingConfig) {
      settings.accountingConfig = {};
    }
    if (!settings.accountingConfig.revenueAccounts) {
      settings.accountingConfig.revenueAccounts = {};
    }

    if (!settings.accountingConfig.revenueAccounts.LAUNDRY || settings.accountingConfig.revenueAccounts.LAUNDRY !== targetCode) {
      settings.accountingConfig.revenueAccounts.LAUNDRY = targetCode;
      await prisma.property.update({
        where: { id: property.id },
        data: { settings }
      });
      console.log(`Updated LAUNDRY revenue GL mapping to '${targetCode}' for property ${property.name}`);
    }
  }

  // Double check duplicates
  const allAccounts = await prisma.chartOfAccount.findMany({
    select: { id: true, code: true, propertyId: true, name: true }
  });

  const codeCounts = new Map();
  const duplicates = [];

  for (const acc of allAccounts) {
    const key = `${acc.propertyId}_${acc.code}`;
    if (!codeCounts.has(key)) {
      codeCounts.set(key, 1);
    } else {
      codeCounts.set(key, codeCounts.get(key) + 1);
      duplicates.push({ propertyId: acc.propertyId, code: acc.code, name: acc.name });
    }
  }

  if (duplicates.length > 0) {
    console.error(`WARNING: Found ${duplicates.length} duplicate account codes!`, duplicates.slice(0, 5));
  } else {
    console.log('SUCCESS: No duplicate Chart of Account codes found per property.');
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

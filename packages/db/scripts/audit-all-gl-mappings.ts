import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== COMPREHENSIVE CASH ACCOUNT AUDIT ===\n');

  // 1. Fetch all properties
  const properties = await prisma.property.findMany();

  for (const property of properties) {
    console.log(`\nPROPERTY: [${property.name}]`);
    console.log('----------------------------------------------------');

    // 2. Fetch all CashAccounts for this property
    const cashAccounts = await prisma.cashAccount.findMany({
      where: { propertyId: property.id },
      include: { glAccount: true }
    });

    console.log('CURRENT CASH ACCOUNTS:');
    if (cashAccounts.length === 0) {
      console.log('  (None)');
    }
    for (const ca of cashAccounts) {
      if (ca.glAccount) {
        console.log(`  🟢 [MAPPED]   ${ca.name} (Type: ${ca.type})`);
        console.log(`               -> Mapped to: ${ca.glAccount.code} - ${ca.glAccount.name}`);
      } else {
        console.log(`  🔴 [UNMAPPED] ${ca.name} (Type: ${ca.type})`);
      }
    }

    // 3. Fetch all ASSET ChartOfAccounts for this property to help with manual mapping
    console.log('\nAVAILABLE ASSET GL ACCOUNTS (For Manual Mapping):');
    const assetAccounts = await prisma.chartOfAccount.findMany({
      where: { propertyId: property.id, type: 'ASSET' },
      orderBy: { code: 'asc' }
    });

    if (assetAccounts.length === 0) {
      console.log('  (None)');
    }
    for (const gl of assetAccounts) {
      console.log(`  - Code: ${gl.code} | Name: ${gl.name}`);
    }
    console.log('\n====================================================');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

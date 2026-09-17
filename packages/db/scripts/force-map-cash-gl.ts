import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== FORCE MANUAL GL MAPPING SCRIPT ===\n');

  const properties = await prisma.property.findMany();

  for (const property of properties) {
    console.log(`Processing Property: ${property.name}`);

    // Fetch all cash accounts and chart of accounts for this property
    const cashAccounts = await prisma.cashAccount.findMany({
      where: { propertyId: property.id }
    });

    const assetAccounts = await prisma.chartOfAccount.findMany({
      where: { propertyId: property.id, type: 'ASSET' }
    });

    // Helper to find a GL account by code
    const getGlByCode = (code: string) => assetAccounts.find(a => a.code === code)?.id;

    for (const ca of cashAccounts) {
      let targetGlCode: string | null = null;

      // Rule: Frontdesk Tills -> 1000
      if (ca.type === 'FRONTDESK_TILL') {
        targetGlCode = '1000';
      }
      // Rule: Server Banks -> 1000
      else if (ca.type === 'SERVER_BANK') {
        targetGlCode = '1000';
      }
      // Rule: Reception Safe -> 1000
      else if (ca.type === 'SAFE' && ca.name.includes('Reception Safe')) {
        targetGlCode = '1000';
      }
      // Rule: Main Corporate Bank Account -> 1010
      else if (ca.type === 'BANK_ACCOUNT' && ca.name.includes('Main Corporate Bank Account')) {
        targetGlCode = '1010';
      }
      // Rule: Cash in Transit -> leave unmapped
      else if (ca.type === 'CASH_IN_TRANSIT') {
        targetGlCode = null;
      }

      if (targetGlCode) {
        const glId = getGlByCode(targetGlCode);
        if (glId) {
          console.log(`  [MAPPING] ${ca.name} -> GL Code: ${targetGlCode}`);
          await prisma.cashAccount.update({
            where: { id: ca.id },
            data: { glAccountId: glId }
          });
        } else {
          console.warn(`  [WARNING] GL Code ${targetGlCode} not found in property ${property.name} for ${ca.name}`);
        }
      } else {
        console.log(`  [SKIPPING] ${ca.name} - Left unmapped`);
        await prisma.cashAccount.update({
            where: { id: ca.id },
            data: { glAccountId: null }
        });
      }
    }
    console.log('----------------------------------------------------');
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

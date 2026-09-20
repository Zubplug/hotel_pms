import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// A map of expected POS/Cash account types to standard USALI 11th edition GL Account Codes
// 11000 - Cash on Hand / Cash Banks
// 11100 - Petty Cash
// 11200 - General Cashier / Safe
const EXACT_USALI_MATCHES: Record<string, string[]> = {
  'SAFE': ['1120', '11200'],
  'STATION_BANK': ['1100', '11000'],
  'SERVER_BANK': ['1100', '11000'],
  'PETTY_CASH': ['1110', '11100'],
  'CASH_IN_TRANSIT': ['1160'],
};

async function main() {
  const isCommit = process.argv.includes('--commit');
  
  console.log('Starting Cash Account to GL Account Backfill Migration...');
  console.log('Using strict USALI code matching only. No historical journals will be generated.');
  
  if (!isCommit) {
    console.log('\n======================================================');
    console.log('⚠️  AUDIT MODE (DRY RUN) - NO CHANGES WILL BE SAVED ⚠️');
    console.log('   Run with --commit to actually save the mappings.');
    console.log('======================================================\n');
  } else {
    console.log('\n⚠️  COMMIT MODE - CHANGES WILL BE SAVED TO DATABASE ⚠️\n');
  }

  const unmappedAccounts = await prisma.cashAccount.findMany({
    where: { glAccountId: null },
    include: { property: true }
  });

  console.log(`Found ${unmappedAccounts.length} unmapped Cash Accounts across all properties.`);

  let mappedCount = 0;
  let skippedCount = 0;

  for (const account of unmappedAccounts) {
    console.log(`\nAnalyzing [${account.property.name}] ${account.name} (Type: ${account.type})`);
    
    const possibleCodes = EXACT_USALI_MATCHES[account.type] || [];
    
    // Look for exact matches in the property's Chart of Accounts
    const exactMatches = await prisma.chartOfAccount.findMany({
      where: {
        propertyId: account.propertyId,
        type: 'ASSET',
        code: { in: possibleCodes }
      }
    });

    if (exactMatches.length === 1) {
      // Exactly one unambiguous match found
      const match = exactMatches[0];
      console.log(`  -> Unambiguous match found! GL Account: ${match.code} - ${match.name}`);
      
      if (isCommit) {
        await prisma.cashAccount.update({
          where: { id: account.id },
          data: { glAccountId: match.id }
        });
      }
      mappedCount++;
    } else if (exactMatches.length > 1) {
      console.log(`  -> Ambiguous match: Found ${exactMatches.length} matching GL codes. Skipping for manual UI mapping.`);
      skippedCount++;
    } else {
      console.log(`  -> No exact match found for USALI codes [${possibleCodes.join(', ')}]. Skipping for manual UI mapping.`);
      skippedCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total Accounts Analyzed: ${unmappedAccounts.length}`);
  console.log(`Successfully Mapped: ${mappedCount}`);
  console.log(`Skipped (Requires UI Mapping): ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

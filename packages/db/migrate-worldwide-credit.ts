import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const creditId = '9321ee8e-1718-4f5a-9518-b3bb4742e789';

  await prisma.$transaction(async (tx) => {
    const credit = await tx.folioCredit.findUnique({
      where: { id: creditId },
      include: { folio: true }
    });

    if (!credit) throw new Error('Credit not found');
    if (Number(credit.remainingAmount) <= 0) {
      console.log('Credit already exhausted.');
      return;
    }

    const corporateAccountId = credit.folio.corporateAccountId;
    if (!corporateAccountId) throw new Error('Credit is not on a corporate folio');

    const corp = await tx.corporateAccount.findUnique({
      where: { id: corporateAccountId },
      include: { cityLedgerAccount: true }
    });

    if (!corp || !corp.cityLedgerAccount) throw new Error('Corporate or City Ledger Account not found');
    const accountId = corp.cityLedgerAccount.id;
    const migrateAmount = Number(credit.remainingAmount);

    console.log(`Migrating ${migrateAmount} ${credit.currency} from FolioCredit to CityLedgerAccount...`);

    // 1. Create CityLedgerEntry for the prepay
    await tx.cityLedgerEntry.create({
      data: {
        accountId,
        propertyId: credit.propertyId,
        amount: migrateAmount,
        currency: credit.currency,
        type: 'PAYMENT',
        status: 'OPEN',
        reference: credit.reference || `Migrated from FolioCredit ${credit.id}`,
        reason: 'Migrated legacy FolioCredit to AR Prepayment system',
        createdBy: credit.receivedBy, 
        createdAt: credit.createdAt // Keep original creation date
      }
    });

    // 2. Adjust CityLedgerAccount balance (make it negative/credit)
    await tx.cityLedgerAccount.update({
      where: { id: accountId },
      data: { balance: { decrement: migrateAmount } }
    });

    // 3. Exhaust the old FolioCredit
    await tx.folioCredit.update({
      where: { id: credit.id },
      data: {
        remainingAmount: 0,
        status: 'EXHAUSTED',
        notes: (credit.notes ? credit.notes + '\n' : '') + 'Migrated to City Ledger AR Prepayment'
      }
    });

    console.log('Migration successful.');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

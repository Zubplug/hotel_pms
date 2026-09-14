import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const corp = await prisma.corporateAccount.findFirst({
    where: { name: { contains: 'Worldwide Commercial', mode: 'insensitive' } }
  });

  if (!corp) {
    console.log('Corporate Account not found.');
    return;
  }
  console.log(`Corporate ID: ${corp.id}`);

  // Find all folios for this corporate account (even 0 balance just to see)
  const folios = await prisma.folio.findMany({
    where: { corporateAccountId: corp.id }
  });
  console.log(`\nFound ${folios.length} folios linked directly to corporateAccountId.`);
  for (const f of folios) {
    console.log(`  Folio ${f.id} | Type: ${f.type} | Balance: ${f.balance}`);
  }

  // Check FolioCredit where folio is linked to this corporate
  const credits = await prisma.folioCredit.findMany({
    where: { folio: { corporateAccountId: corp.id } }
  });
  console.log(`\nFound ${credits.length} FolioCredits.`);
  for (const c of credits) {
    console.log(`  Credit ${c.id} | Amount: ${c.amount} | Remaining: ${c.remainingAmount}`);
  }

  // Check Reservations linked to this corporate account
  const reservations = await prisma.reservation.findMany({
    where: { corporateAccountId: corp.id },
    include: { folios: true }
  });
  console.log(`\nFound ${reservations.length} Reservations linked to corporate.`);
  let resFolioCount = 0;
  for (const r of reservations) {
    for (const f of r.folios) {
      if (Number(f.balance) !== 0) {
        console.log(`  Res ${r.id} -> Folio ${f.id} | Type: ${f.type} | Balance: ${f.balance}`);
        resFolioCount++;
      }
    }
  }
  if (resFolioCount === 0) console.log('  No non-zero folios found on reservations.');

}

main().catch(console.error).finally(() => prisma.$disconnect());

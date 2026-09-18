import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB sweep for corrupted folios...");
  
  // Find all folios
  const folios = await prisma.folio.findMany({
    include: {
      items: {
        where: { type: 'PAYMENT' }
      }
    }
  });

  let corrupted = [];
  for (const folio of folios) {
    const calculatedTotalPayments = folio.items.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const recordedTotalPayments = Number(folio.totalPayments);

    if (calculatedTotalPayments !== recordedTotalPayments) {
      corrupted.push({
        folioId: folio.id,
        folioNumber: folio.folioNumber,
        recordedTotalPayments,
        calculatedTotalPayments,
        difference: calculatedTotalPayments - recordedTotalPayments,
        recordedBalance: Number(folio.balance),
        calculatedBalance: Number(folio.totalCharges) - calculatedTotalPayments
      });
    }
  }

  console.log(`Found ${corrupted.length} corrupted folios.`);
  console.log(JSON.stringify(corrupted, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

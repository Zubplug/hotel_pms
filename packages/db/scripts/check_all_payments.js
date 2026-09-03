const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessionRef = 'FD-20260902-689AA27C';
  const payments = await prisma.payment.findMany({
      where: { frontdeskSession: { shiftReference: sessionRef } },
      include: {
          folio: {
              select: { folioNumber: true, type: true }
          },
          reservation: {
              select: { status: true, confirmationNumber: true }
          }
      }
  });

  if (payments.length === 0) {
      console.log("No payments found for this shift.");
      return;
  }

  for (const p of payments) {
      console.log(`- Amount: ${p.amount} ${p.currency} | Method: ${p.method} | Status: ${p.status}`);
      console.log(`  Folio: ${p.folio?.folioNumber} (Type: ${p.folio?.type})`);
      console.log(`  Reservation: ${p.reservation?.confirmationNumber} (Status: ${p.reservation?.status})`);
      console.log('---');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessionRef = 'FD-20260902-689AA27C';
  const session = await prisma.frontdeskSession.findUnique({
      where: { shiftReference: sessionRef },
      include: {
          payments: {
              include: {
                  folio: {
                      select: {
                          id: true,
                          folioNumber: true,
                          type: true
                      }
                  }
              }
          }
      }
  });

  if (!session) {
      console.log(`Session ${sessionRef} not found`);
      return;
  }

  console.log(`Payments for Session ${sessionRef}:`);
  if (session.payments.length === 0) {
      console.log("No payments found for this shift.");
  } else {
      for (const p of session.payments) {
          console.log(`- Amount: ${p.amount} ${p.currency} | Method: ${p.method} | Status: ${p.status} | Folio: ${p.folio?.folioNumber} (Type: ${p.folio?.type})`);
      }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  // Find all payments that have NO frontdeskSessionId for this property
  const unlinkedPayments = await prisma.payment.findMany({
      where: {
          propertyId: property.id,
          frontdeskSessionId: null
      },
      include: {
          folio: { select: { folioNumber: true, type: true } },
          reservation: { select: { confirmationNumber: true, status: true } }
      }
  });

  console.log(`Found ${unlinkedPayments.length} payments with NO shift linked:`);
  for (const p of unlinkedPayments) {
      console.log(`- ID: ${p.id} | Amount: ${p.amount} | Date: ${p.createdAt} | Res: ${p.reservation?.confirmationNumber}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

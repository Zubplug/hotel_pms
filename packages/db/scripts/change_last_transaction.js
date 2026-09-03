const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  if (!property) {
      console.log("Stanzel property not found");
      return;
  }

  // Find the latest CASH payment for this property today
  const latestCashPayment = await prisma.payment.findFirst({
      where: {
          propertyId: property.id,
          method: 'CASH',
      },
      orderBy: {
          createdAt: 'desc'
      },
      include: {
          folio: true,
          frontdeskSession: true
      }
  });

  if (!latestCashPayment) {
      console.log("No recent CASH payment found for Stanzel Front Desk.");
      return;
  }

  console.log(`Found latest CASH payment:`);
  console.log(`- ID: ${latestCashPayment.id}`);
  console.log(`- Amount: ${latestCashPayment.amount}`);
  console.log(`- Folio: ${latestCashPayment.folio?.folioNumber}`);
  console.log(`- Session: ${latestCashPayment.frontdeskSession?.shiftReference}`);
  console.log(`- Date: ${latestCashPayment.createdAt}`);

  // Update it to POS
  await prisma.payment.update({
      where: { id: latestCashPayment.id },
      data: { method: 'POS' }
  });

  console.log(`✅ Successfully changed payment method from CASH to POS.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return;

  const targetShiftRef = 'FD-20260902-689AA27C';
  const targetShift = await prisma.frontdeskSession.findUnique({
      where: { shiftReference: targetShiftRef }
  });

  if (!targetShift) {
      console.log(`Shift ${targetShiftRef} not found`);
      return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  // Find payments created today that are NOT on this shift
  const paymentsToUpdate = await prisma.payment.findMany({
      where: {
          propertyId: property.id,
          createdAt: { gte: today },
          frontdeskSessionId: { not: targetShift.id }
      },
      include: {
          folio: { select: { folioNumber: true, type: true } }
      }
  });

  if (paymentsToUpdate.length === 0) {
      console.log("No other payments found today to link to this shift.");
  } else {
      console.log(`Found ${paymentsToUpdate.length} payments. Linking them to shift ${targetShiftRef}...`);
      for (const p of paymentsToUpdate) {
          await prisma.payment.update({
              where: { id: p.id },
              data: { frontdeskSessionId: targetShift.id }
          });
          console.log(`✅ Linked Payment ${p.id} (${p.amount} ${p.method}) on Folio ${p.folio?.folioNumber} to shift.`);
      }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

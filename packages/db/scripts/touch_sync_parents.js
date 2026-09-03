const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetShiftRef = 'FD-20260902-689AA27C';
  
  // Find all payments linked to this shift
  const payments = await prisma.payment.findMany({
      where: { frontdeskSession: { shiftReference: targetShiftRef } },
      select: { folioId: true, reservationId: true }
  });

  const folioIds = [...new Set(payments.map(p => p.folioId).filter(Boolean))];
  const resIds = [...new Set(payments.map(p => p.reservationId).filter(Boolean))];

  console.log(`Found ${folioIds.length} Folios and ${resIds.length} Reservations to touch.`);

  // "Touch" Folios by doing an empty update (which bumps updatedAt)
  if (folioIds.length > 0) {
      await prisma.folio.updateMany({
          where: { id: { in: folioIds } },
          data: { updatedAt: new Date() }
      });
      console.log(`✅ Touched ${folioIds.length} Folios`);
  }

  // "Touch" Reservations
  if (resIds.length > 0) {
      await prisma.reservation.updateMany({
          where: { id: { in: resIds } },
          data: { updatedAt: new Date() }
      });
      console.log(`✅ Touched ${resIds.length} Reservations`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

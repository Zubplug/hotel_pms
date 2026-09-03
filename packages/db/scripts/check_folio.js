const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const folio = await prisma.folio.findUnique({
      where: { folioNumber: 'FOL-930804' },
      include: {
          reservation: {
              select: { status: true, checkIn: true, checkOut: true }
          },
          charges: true
      }
  });

  if (!folio) {
      console.log("Folio not found");
      return;
  }
  
  console.log(`Folio: ${folio.folioNumber} (Type: ${folio.type}, Status: ${folio.status})`);
  console.log(`Reservation Status: ${folio.reservation?.status}`);
  console.log(`Check In: ${folio.reservation?.checkIn}`);
  console.log(`Charges count: ${folio.charges.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

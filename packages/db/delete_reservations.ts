import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all payments...');
  await prisma.payment.deleteMany();

  console.log('Deleting all folio items...');
  await prisma.folioItem.deleteMany();

  console.log('Deleting all folios...');
  await prisma.folio.deleteMany();

  console.log('Deleting all lock credentials...');
  await prisma.lockCredential.deleteMany();

  console.log('Deleting all lock operations...');
  await prisma.lockOperation.deleteMany();

  console.log('Deleting all reservation guests...');
  await prisma.reservationGuest.deleteMany();

  console.log('Deleting all reservation priorities...');
  await prisma.reservationPriority.deleteMany();

  console.log('Deleting all reservation rooms...');
  await prisma.reservationRoom.deleteMany();

  console.log('Deleting all reservations...');
  const res = await prisma.reservation.deleteMany();
  
  console.log(`Successfully deleted ${res.count} reservations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

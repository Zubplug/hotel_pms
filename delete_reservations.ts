import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup...');

  try {
    // Delete all reservation-related data
    await prisma.folioTransaction.deleteMany();
    await prisma.folio.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.reservationRoom.deleteMany();
    await prisma.lockCredential.deleteMany();
    await prisma.reservation.deleteMany();

    // Reset room statuses
    await prisma.room.updateMany({
      data: {
        status: 'AVAILABLE'
      }
    });

    console.log('Successfully deleted all reservations and related financial data.');
    console.log('All rooms have been reset to AVAILABLE.');

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

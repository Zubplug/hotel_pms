const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function run() {
  const propertyId = 'test_prop_' + Date.now();
  const rawToken = 'test_token_' + Date.now();
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const term = await prisma.posTerminal.create({
    data: {
      propertyId,
      name: 'Test Terminal',
      macAddress: '00:00:00',
      registrationState: 'REGISTERED',
      deviceCredentialHash: hash
    }
  });

  const res = await prisma.reservation.create({
    data: {
      propertyId,
      status: 'PENDING',
      confirmationNumber: 'TEST1234',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 86400000),
      primaryGuestId: 'dummy' // Might fail foreign key if guest doesn't exist
    }
  }).catch(e => {
     console.log('Skipping Prisma DB prep (no dummy guest)', e.message);
     return { id: 'dummy_res' };
  });

  // We can just send requests to localhost:3000 if it's running.
  console.log('Test setup done.');
}
run().finally(() => prisma.$disconnect());

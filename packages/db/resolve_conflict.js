const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const eventId = '945d087e-eef3-4dd3-935c-0a2541baf24f';
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046'; // from previous logs
  const aggregateId = 'a93229b6-9d31-4707-9aa3-3211041a2592'; // from user prompt

  // Insert dummy HotelEvent
  await prisma.hotelEvent.upsert({
    where: { id: eventId },
    update: {},
    create: {
      id: eventId,
      idempotencyKey: 'dummy-resolution-key-' + eventId,
      propertyId,
      deviceId: '372ffa7b-062d-4612-938f-e76d959b8be8', // dummy
      operatorId: 'e277e79a-d037-4ceb-be94-2350b7d9a712', // dummy
      aggregateType: 'RESERVATION',
      aggregateId,
      aggregateVersion: 1,
      eventType: 'KEYCARD_ENCODE',
      sequence: 1,
      payload: {},
      occurredAt: new Date(),
    }
  });

  // Insert SyncConflict
  await prisma.syncConflict.upsert({
    where: { hotelEventId: eventId },
    update: {
      status: 'RESOLVED',
      resolution: 'APPLY_EDGE',
      resolvedAt: new Date()
    },
    create: {
      propertyId,
      hotelEventId: eventId,
      aggregateType: 'RESERVATION',
      aggregateId,
      expectedVersion: 2,
      receivedVersion: 1,
      conflictReason: 'Manual fix',
      status: 'RESOLVED',
      resolution: 'APPLY_EDGE',
      resolvedAt: new Date()
    }
  });

  console.log('Dummy resolved conflict created!');
}

run().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function runTests() {
  console.log("Setting up Concurrency Test Environment...");
  
  // Create test property and aggregate
  const property = await prisma.property.create({
    data: { name: 'Test Property ' + Date.now(), address: '123 Test St', currency: 'NGN' }
  });
  
  const guest = await prisma.guest.create({
    data: { propertyId: property.id, firstName: 'Test', lastName: 'Guest' }
  });
  
  const reservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      status: 'CONFIRMED',
      arrivalDate: new Date(),
      departureDate: new Date(),
      version: 1
    }
  });

  const folio = await prisma.folio.create({
    data: {
      propertyId: property.id,
      reservationId: reservation.id,
      guestId: guest.id,
      balance: 0,
      totalCharges: 0,
      totalPayments: 0,
      version: 1
    }
  });
  
  const testToken = 'test-token';
  const sha256Hash = crypto.createHash('sha256').update(testToken).digest('hex');
  
  const terminal = await prisma.posTerminal.create({
    data: {
      terminalCode: 'TEST-TERM-' + Date.now(),
      name: 'Test Terminal',
      terminalType: 'FRONT_DESK',
      organisationId: '00000000-0000-0000-0000-000000000000', // Mock org
      propertyId: property.id,
      outletId: '00000000-0000-0000-0000-000000000000',
      deviceCredentialHash: sha256Hash,
      registrationState: 'REGISTERED'
    }
  });

  async function callApi(events) {
     const payload = {
         propertyId: property.id,
         events
     };
     
     const res = await fetch('http://localhost:3000/api/v1/sync/push/frontdesk', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + testToken 
         },
         body: JSON.stringify(payload)
     });
     
     if (!res.ok) {
         console.error("HTTP Error", res.status);
         const text = await res.text();
         console.error(text);
         return null;
     }
     
     return res.json();
  }
  
  console.log("Setup complete. Folio ID:", folio.id, "Reservation ID:", reservation.id);
  
  const baseIdemA = 'idem-a-' + Date.now();
  
  // Test A: Competing Events
  console.log("\n--- Test A: Competing Events ---");
  const eventA = {
      id: 'evt-a-' + Date.now(),
      idempotencyKey: baseIdemA,
      aggregateType: 'FOLIO',
      aggregateId: folio.id,
      aggregateVersion: 1,
      eventType: 'ROOM_CHARGE',
      occurredAt: new Date().toISOString(),
      sequence: 1,
      payloadJson: JSON.stringify({ amount: 1000, description: 'Room Service' })
  };
  const eventB = {
      id: 'evt-b-' + Date.now(),
      idempotencyKey: 'idem-b-' + Date.now(),
      aggregateType: 'FOLIO',
      aggregateId: folio.id,
      aggregateVersion: 1, // BOTH ARE COMPETING FOR VERSION 1
      eventType: 'ROOM_CHARGE',
      occurredAt: new Date().toISOString(),
      sequence: 1,
      payloadJson: JSON.stringify({ amount: 1500, description: 'Minibar' })
  };

  // Run simultaneously
  const [resA, resB] = await Promise.all([
      callApi([eventA]),
      callApi([eventB])
  ]);

  console.log("Result A:", resA?.results);
  console.log("Result B:", resB?.results);
  
  const fAfterA = await prisma.folio.findUnique({ where: { id: folio.id } });
  const eventsCount = await prisma.hotelEvent.count({ where: { aggregateId: folio.id } });
  const conflictCount = await prisma.syncConflict.count({ where: { aggregateId: folio.id } });
  
  console.log(`Folio Version: ${fAfterA?.version} (Expected: 2)`);
  console.log(`HotelEvents: ${eventsCount} (Expected: 1)`);
  console.log(`SyncConflicts: ${conflictCount} (Expected: 1)`);

  // Test B: Duplicate Retry
  console.log("\n--- Test B: Duplicate Retry ---");
  const resRetryA = await callApi([eventA]);
  console.log("Result Retry A:", resRetryA?.results);
  const fAfterRetry = await prisma.folio.findUnique({ where: { id: folio.id } });
  console.log(`Folio Version: ${fAfterRetry?.version} (Expected: 2)`);

  // Test C: Sequential Event
  console.log("\n--- Test C: Sequential Event ---");
  const eventC = {
      id: 'evt-c-' + Date.now(),
      idempotencyKey: 'idem-c-' + Date.now(),
      aggregateType: 'FOLIO',
      aggregateId: folio.id,
      aggregateVersion: 2, // NOW VERSION 2
      eventType: 'ROOM_CHARGE',
      occurredAt: new Date().toISOString(),
      sequence: 2,
      payloadJson: JSON.stringify({ amount: 500, description: 'Laundry' })
  };
  const resC = await callApi([eventC]);
  console.log("Result C:", resC?.results);
  const fAfterC = await prisma.folio.findUnique({ where: { id: folio.id } });
  console.log(`Folio Version: ${fAfterC?.version} (Expected: 3)`);

  // Test D: Dependent Conflict
  console.log("\n--- Test D: Dependent Conflict ---");
  const eventCheckIn = {
      id: 'evt-d1-' + Date.now(),
      idempotencyKey: 'idem-d1-' + Date.now(),
      aggregateType: 'RESERVATION',
      aggregateId: reservation.id,
      aggregateVersion: 100, // Deliberately wrong
      eventType: 'CHECK_IN',
      occurredAt: new Date().toISOString(),
      sequence: 1,
      payloadJson: "{}"
  };
  const resD1 = await callApi([eventCheckIn]);
  console.log("Result Check-In (wrong version):", resD1?.results);
  
  console.log("\nAll tests completed!");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());

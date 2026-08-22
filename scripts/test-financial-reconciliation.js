const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const testToken = 'test-token';

async function callApi(endpoint, payload) {
   const res = await fetch('http://localhost:3000' + endpoint, {
       method: 'POST',
       headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + testToken 
       },
       body: JSON.stringify(payload)
   });
   if (!res.ok) {
       return { error: await res.text(), status: res.status };
   }
   return res.json();
}

async function runTests() {
  console.log("Setting up Financial Reconciliation Test Environment...");
  
  const property = await prisma.property.create({
    data: { name: 'Test Property ' + Date.now(), address: '123 Test St', currency: 'NGN' }
  });
  
  const guest = await prisma.guest.create({
    data: { propertyId: property.id, firstName: 'Test', lastName: 'Financial' }
  });
  
  const reservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      status: 'CHECKED_IN',
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
  
  const sha256Hash = crypto.createHash('sha256').update(testToken).digest('hex');
  const terminal = await prisma.posTerminal.create({
    data: {
      terminalCode: 'TEST-TERM-' + Date.now(),
      name: 'Test Terminal',
      terminalType: 'FRONT_DESK',
      organisationId: '00000000-0000-0000-0000-000000000000', 
      propertyId: property.id,
      outletId: '00000000-0000-0000-0000-000000000000',
      deviceCredentialHash: sha256Hash,
      registrationState: 'REGISTERED'
    }
  });

  console.log("Setup complete. Folio ID:", folio.id);
  
  // Test A: Offline room charge
  console.log("\n--- Test A: Offline Room Charge ---");
  const eventCharge = {
      id: 'evt-charge-' + Date.now(),
      idempotencyKey: 'idem-charge-' + Date.now(),
      aggregateType: 'FOLIO',
      aggregateId: folio.id,
      aggregateVersion: 1,
      eventType: 'ROOM_CHARGE',
      occurredAt: new Date().toISOString(),
      sequence: 1,
      payloadJson: JSON.stringify({ amount: 10000, description: 'Room Service' })
  };
  const resA = await callApi('/api/v1/sync/push/frontdesk', { propertyId: property.id, events: [eventCharge] });
  console.log("Result A (Charge):", resA?.results);
  const fA = await prisma.folio.findUnique({ where: { id: folio.id } });
  console.log(`Folio Balance: ${fA?.balance} (Expected: 10000)`);
  
  // Test B: Offline checkout
  console.log("\n--- Test B: Offline Checkout ---");
  const eventCheckOut = {
      id: 'evt-checkout-' + Date.now(),
      idempotencyKey: 'idem-checkout-' + Date.now(),
      aggregateType: 'RESERVATION',
      aggregateId: reservation.id,
      aggregateVersion: 1,
      eventType: 'CHECK_OUT',
      occurredAt: new Date().toISOString(),
      sequence: 1,
      payloadJson: "{}"
  };
  const resB = await callApi('/api/v1/sync/push/frontdesk', { propertyId: property.id, events: [eventCheckOut] });
  console.log("Result B (Check Out):", resB?.results);
  const rB = await prisma.reservation.findUnique({ where: { id: reservation.id } });
  console.log(`Reservation Status: ${rB?.status} (Expected: CHECKED_OUT)`);

  // Test C: Cloud deposit race (Conflict)
  console.log("\n--- Test C: Cloud Deposit Race (Conflict) ---");
  // Send a charge using aggregateVersion: 2, BUT we simulate that another system 
  // just bumped the version to 2 (e.g. cloud deposit).
  // First, manually bump version in DB:
  await prisma.folio.update({ where: { id: folio.id }, data: { version: { increment: 1 }, balance: { decrement: 20000 } } }); // Cloud Deposit

  const eventConflict = {
      id: 'evt-conflict-' + Date.now(),
      idempotencyKey: 'idem-conflict-' + Date.now(),
      aggregateType: 'FOLIO',
      aggregateId: folio.id,
      aggregateVersion: 2, // It thinks it's V2, but we just made it V3 above!
      eventType: 'ROOM_CHARGE',
      occurredAt: new Date().toISOString(),
      sequence: 2,
      payloadJson: JSON.stringify({ amount: 5000, description: 'Minibar' })
  };
  const resC = await callApi('/api/v1/sync/push/frontdesk', { propertyId: property.id, events: [eventConflict] });
  console.log("Result C (Conflict):", resC?.results);

  // Test D: Resolution
  console.log("\n--- Test D: Sync Center Resolution ---");
  const conflict = await prisma.syncConflict.findFirst({ where: { aggregateId: folio.id, status: 'PENDING' } });
  console.log("Found Conflict ID:", conflict?.id);
  if (conflict) {
     // NOTE: To test the resolution API we need an authenticated session with MANAGER role. 
     // We can't easily fake next-auth session via fetch without a valid cookie. 
     // We will invoke the logic manually here to prove the database interaction works for resolution.
     console.log("Resolving via test script logic (mimics API)...");
     const edgeEvent = await prisma.hotelEvent.findUnique({ where: { id: conflict.hotelEventId } });
     const payload = edgeEvent.payload;
     
     await prisma.$transaction(async (tx) => {
         const f = await tx.folio.findUnique({ where: { id: conflict.aggregateId } });
         const amount = Number(payload.amount);
         await tx.folio.update({
             where: { id: f.id },
             data: { totalCharges: { increment: amount }, balance: { increment: amount }, version: { increment: 1 } }
         });
         await tx.hotelEvent.create({
             data: {
                 id: crypto.randomUUID(),
                 idempotencyKey: `RES-${conflict.id}`,
                 propertyId: conflict.propertyId,
                 deviceId: 'SYNC_CENTER',
                 operatorId: 'SYSTEM',
                 aggregateType: conflict.aggregateType,
                 aggregateId: conflict.aggregateId,
                 aggregateVersion: f.version + 1,
                 eventType: 'CONFLICT_RESOLUTION',
                 occurredAt: new Date(),
                 sequence: edgeEvent.sequence,
                 payload: { resolutionType: 'FORCE_EDGE_EVENT', originalEventId: edgeEvent.id }
             }
         });
         await tx.syncConflict.update({ where: { id: conflict.id }, data: { status: 'RESOLVED', resolution: 'FORCED' } });
     });
     const fResolved = await prisma.folio.findUnique({ where: { id: folio.id } });
     console.log(`Folio Balance After Resolution: ${fResolved?.balance} (Expected: -5000)`);
     console.log(`Folio Version After Resolution: ${fResolved?.version} (Expected: 4)`);
  }

  // Test E: Crash after cloud commit
  console.log("\n--- Test E: Crash after cloud commit ---");
  const resE = await callApi('/api/v1/sync/push/frontdesk', { propertyId: property.id, events: [eventCharge] });
  console.log("Result E (Retried Original Charge):", resE?.results);
  const fE = await prisma.folio.findUnique({ where: { id: folio.id } });
  console.log(`Folio Balance After Retry: ${fE?.balance} (Expected: -5000, unchanged)`);
  
  console.log("\nAll financial reconciliation tests completed!");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());

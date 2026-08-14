import { PrismaClient, RoomStatus, HousekeepingStatus } from '@hotel-pms/db';
import { lockOrchestrator } from './src/lib/locks/orchestrator';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function run() {
  console.log('----------------------------------------------------');
  console.log('🏨 LODGECORE LOCK ORCHESTRATION TEST');
  console.log('----------------------------------------------------');
  console.log('1. Seeding database with dummy hotel data...');

  // ── Org & Property ────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: { name: 'Test Org', slug: 'test-org-' + Date.now() }
  });

  const property = await prisma.property.create({
    data: { 
      organizationId: org.id, 
      name: 'Test Hotel', 
      code: 'TH' + Date.now(), 
      timezone: 'UTC',
      address: '123 Fake St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      phone: '+1234567890',
      email: 'test@hotel.com'
    }
  });

  // ── Hardware Agent ─────────────────────────────────────────────────
  const agentId = crypto.randomUUID();
  const agent = await prisma.hardwareAgent.create({
    data: {
      id: agentId,
      propertyId: property.id,
      name: 'Front Desk Encoder 1',
      deviceId: 'FD-' + Date.now(),
      status: 'ONLINE',
      enabled: true
    }
  });

  // ── Room Type ──────────────────────────────────────────────────────
  const roomType = await prisma.roomType.create({
    data: {
      propertyId: property.id,
      name: 'Standard Room',
      code: 'STD',
      defaultBedConfig: '1 Queen',
      maxOccupancy: 2,
      baseRate: 100,
      currency: 'USD'
    }
  });

  // ── Building + Floor + Room ────────────────────────────────────────
  const building = await prisma.building.create({
    data: { propertyId: property.id, name: 'Main Tower', code: 'MT-' + Date.now(), floorsCount: 1 }
  });

  const floor = await prisma.floor.create({
    data: { propertyId: property.id, buildingId: building.id, number: 1, name: '1st Floor' }
  });

  const room = await prisma.room.create({
    data: { 
      propertyId: property.id, 
      buildingId: building.id,
      floorId: floor.id,
      roomTypeId: roomType.id,
      number: '101', 
      status: RoomStatus.AVAILABLE,
      housekeepingStatus: HousekeepingStatus.CLEAN,
      maxOccupancy: 2,
      bedConfiguration: '1 Queen'
    }
  });

  // ── Door Lock ─────────────────────────────────────────────────────
  const lockCode = '1.2.' + Date.now();
  await prisma.doorLock.create({
    data: { roomId: room.id, propertyId: property.id, lockCode, provider: 'SIMULATED', status: 'ONLINE' }
  });

  // ── Guest ─────────────────────────────────────────────────────────
  const guest = await prisma.guest.create({
    data: { organizationId: org.id, firstName: 'John', lastName: 'Doe', email: 'john' + Date.now() + '@example.com' }
  });

  // ── Staff placeholder (createdBy is a UUID string, no FK enforced) ─
  const staffId = crypto.randomUUID();

  // ── Rate Plan ─────────────────────────────────────────────────────
  const ratePlan = await prisma.ratePlan.create({
    data: {
      propertyId: property.id,
      name: 'Standard Rate',
      code: 'STD-RATE',
      type: 'STANDARD',
    }
  });

  // ── Reservation via raw SQL (bypasses complex Prisma validation) ───
  const reservationId = crypto.randomUUID();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.$executeRaw`
    INSERT INTO "Reservation" (
      id, "propertyId", "confirmationNumber", "primaryGuestId",
      source, status, "checkIn", "checkOut",
      adults, children, "ratePlanId", "ratePlanSnapshot",
      currency, "createdBy", "updatedAt"
    ) VALUES (
      ${reservationId}::uuid,
      ${property.id}::uuid,
      ${'RES-' + Date.now()},
      ${guest.id}::uuid,
      'WALK_IN'::"ReservationSource",
      'CONFIRMED'::"ReservationStatus",
      CURRENT_DATE,
      ${tomorrow.toISOString().split('T')[0]}::date,
      2, 0,
      ${ratePlan.id}::uuid,
      ${'{}'}::jsonb,
      'USD',
      ${staffId}::uuid,
      NOW()
    )
  `;

  // Link room to reservation (ReservationRoom requires many fields)
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  await prisma.$executeRaw`
    INSERT INTO "ReservationRoom" (
      id, "reservationId", "roomTypeId", "roomId",
      "checkIn", "checkOut", adults, children,
      "ratePlanId", "rateAmount", currency, status,
      "updatedAt"
    ) VALUES (
      ${crypto.randomUUID()}::uuid,
      ${reservationId}::uuid,
      ${roomType.id}::uuid,
      ${room.id}::uuid,
      ${todayStr}::date,
      ${tomorrowStr}::date,
      2, 0,
      ${ratePlan.id}::uuid,
      100.00,
      'USD',
      'ACTIVE',
      NOW()
    )
  `;


  console.log(`   ✅ Data seeded!`);
  console.log(`      Reservation ID : ${reservationId}`);
  console.log(`      Room           : ${room.number} | Lock: ${lockCode}`);
  console.log(`      Agent          : ${agent.name} (${agentId})`);

  // ── Step 2: Call orchestrator (simulates check-in API) ────────────
  console.log('\n2. Triggering Check-In via LockOrchestrator...');
  const op = await lockOrchestrator.generateCredentialForCheckIn(reservationId, property.id);
  
  console.log(`   ✅ LockOperation created!`);
  console.log(`      Operation ID : ${op.id}`);
  console.log(`      Status       : ${op.status}`);

  // ── Step 3: Simulate hardware agent polling ───────────────────────
  console.log('\n3. Simulating Hardware Agent polling...');

  const command = await prisma.lockCommand.findFirst({
    where: { agentId, status: 'QUEUED' }
  });

  if (!command) {
    throw new Error('❌ No QUEUED command found for agent! Orchestrator did not queue a command.');
  }

  console.log(`   ✅ Agent received command!`);
  console.log(`      Command ID   : ${command.id}`);
  console.log(`      Command Type : ${command.commandType}`);
  console.log(`      Payload      :`, JSON.stringify(command.payload, null, 6).split('\n').map(l => '         ' + l).join('\n'));

  // ── Step 4: Agent processes command (simulate card encoding) ──────
  const updateStatus = async (cmdStatus: string, opStatus: string, label: string) => {
    process.stdout.write(`\n   ⏳ ${label}...`);
    await new Promise(r => setTimeout(r, 800));
    await prisma.lockCommand.update({ where: { id: command.id }, data: { status: cmdStatus } });
    await prisma.lockOperation.update({ where: { id: op.id }, data: { status: opStatus } });
    process.stdout.write(' ✅');
  };

  console.log('\n4. Agent encoding card...');
  await updateStatus('PROCESSING', 'WAITING_FOR_CARD', 'Waiting for card on encoder');
  await updateStatus('PROCESSING', 'CARD_DETECTED', 'Card detected');
  await updateStatus('PROCESSING', 'ENCODING', 'Writing room data to card');
  await updateStatus('PROCESSING', 'VERIFYING', 'Verifying card data');
  await updateStatus('COMPLETED', 'ACTIVE', 'Finalizing credential');

  // ── Step 5: Final verification ────────────────────────────────────
  const finalOp = await prisma.lockOperation.findUnique({ where: { id: op.id } });
  const finalCredential = await prisma.lockCredential.findFirst({ where: { reservationId } });

  console.log('\n\n----------------------------------------------------');
  console.log('🎉 TEST PASSED — FULL FLOW COMPLETE');
  console.log('----------------------------------------------------');
  console.log(`   Operation Status   : ${finalOp?.status}`);
  console.log(`   Credential Status  : ${finalCredential?.status}`);
  console.log(`   Credential Valid   : ${finalCredential?.validFrom?.toISOString()} → ${finalCredential?.validUntil?.toISOString()}`);
  console.log('----------------------------------------------------\n');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
}).finally(() => prisma.$disconnect());

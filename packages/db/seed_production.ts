import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to clear existing property layout...');
  
  // Get the first property (assuming there is only one for now)
  const property = await prisma.property.findFirst();
  if (!property) {
    throw new Error('No property found to seed.');
  }

  const propertyId = property.id;
  console.log(`Operating on Property: ${property.name} (${propertyId})`);

  // 1. DELETE EXISTING DATA
  console.log('Deleting Lock Credentials...');
  await prisma.lockCredential.deleteMany({ where: { reservation: { propertyId } } });
  
  console.log('Deleting Lock Commands & Operations...');
  await prisma.lockCommand.deleteMany({ where: { operation: { propertyId } } });
  await prisma.lockOperation.deleteMany({ where: { propertyId } });

  console.log('Deleting Folio Items, Refunds, and Payments...');
  await prisma.folioItem.deleteMany({ where: { folio: { reservation: { propertyId } } } });
  await prisma.refund.deleteMany({ where: { propertyId } });
  await prisma.payment.deleteMany({ where: { propertyId } });

  console.log('Deleting Folios...');
  await prisma.folio.deleteMany({ where: { reservation: { propertyId } } });

  console.log('Deleting Guest Service Requests...');
  await prisma.guestServiceRequest.deleteMany({ where: { propertyId } });

  console.log('Deleting Reservation Guests...');
  await prisma.reservationGuest.deleteMany({ where: { reservation: { propertyId } } });

  console.log('Deleting Reservation Rooms...');
  await prisma.reservationRoom.deleteMany({ where: { reservation: { propertyId } } });

  console.log('Deleting Reservations...');
  await prisma.reservation.deleteMany({ where: { propertyId } });

  console.log('Deleting Room Blocks & Statuses...');
  await prisma.roomBlock.deleteMany({ where: { room: { propertyId } } });
  await prisma.roomStatusHistory.deleteMany({ where: { room: { propertyId } } });

  console.log('Deleting Rooms...');
  await prisma.room.deleteMany({ where: { propertyId } });

  console.log('Deleting Rates & Rate Plans...');
  await prisma.rate.deleteMany({ where: { ratePlan: { propertyId } } });
  await prisma.ratePlan.deleteMany({ where: { propertyId } });

  console.log('Deleting Room Types...');
  await prisma.roomType.deleteMany({ where: { propertyId } });

  console.log('Deleting Floors...');
  await prisma.floor.deleteMany({ where: { building: { propertyId } } });

  console.log('Deleting Buildings...');
  await prisma.building.deleteMany({ where: { propertyId } });

  console.log('Existing demo layout cleared.');

  // 2. SEED NEW DATA
  console.log('Creating Building STANZEL 1...');
  const building = await prisma.building.create({
    data: {
      propertyId,
      name: 'STANZEL 1',
      code: 'STANZEL1',
      floorsCount: 4
    },
  });

  console.log('Creating Floors...');
  const floor1 = await prisma.floor.create({ data: { buildingId: building.id, propertyId, name: '001', number: 1 } });
  const floor2 = await prisma.floor.create({ data: { buildingId: building.id, propertyId, name: '002', number: 2 } });
  const floor3 = await prisma.floor.create({ data: { buildingId: building.id, propertyId, name: '003', number: 3 } });
  const floor4 = await prisma.floor.create({ data: { buildingId: building.id, propertyId, name: '004', number: 4 } });

  console.log('Creating Room Types...');
  const roomTypesData = [
    { name: 'SUPERIOR', code: 'SUP', baseRate: 15000, currency: 'NGN', maxAdults: 2, maxOccupancy: 2, defaultBedConfig: '1 King Bed', propertyId },
    { name: 'STANDARD', code: 'STD', baseRate: 10000, currency: 'NGN', maxAdults: 2, maxOccupancy: 2, defaultBedConfig: '1 Queen Bed', propertyId },
    { name: 'SUITE', code: 'STE', baseRate: 25000, currency: 'NGN', maxAdults: 3, maxOccupancy: 3, defaultBedConfig: '1 King Bed, 1 Sofa Bed', propertyId },
    { name: 'DULUXE', code: 'DLX', baseRate: 20000, currency: 'NGN', maxAdults: 2, maxOccupancy: 2, defaultBedConfig: '1 King Bed', propertyId },
    { name: 'EXECUTIVE', code: 'EXE', baseRate: 30000, currency: 'NGN', maxAdults: 2, maxOccupancy: 2, defaultBedConfig: '1 King Bed', propertyId },
  ];
  
  const roomTypes: Record<string, string> = {};
  for (const rt of roomTypesData) {
    const created = await prisma.roomType.create({ data: rt });
    roomTypes[rt.name] = created.id;
  }

  console.log('Creating Rooms...');
  const roomsToCreate = [
    // Floor 1
    { number: '101', type: 'SUPERIOR', floor: floor1.id },
    { number: '102', type: 'SUPERIOR', floor: floor1.id },
    { number: '103', type: 'SUPERIOR', floor: floor1.id },
    { number: '104', type: 'STANDARD', floor: floor1.id },
    { number: '105', type: 'STANDARD', floor: floor1.id },

    // Floor 2
    { number: '201', type: 'SUITE', floor: floor2.id },
    { number: '202', type: 'DULUXE', floor: floor2.id },
    { number: '203', type: 'STANDARD', floor: floor2.id },
    { number: '204', type: 'STANDARD', floor: floor2.id },
    { number: '205', type: 'STANDARD', floor: floor2.id },
    { number: '206', type: 'SUPERIOR', floor: floor2.id },
    { number: '207', type: 'DULUXE', floor: floor2.id },
    { number: '208', type: 'SUPERIOR', floor: floor2.id },
    { number: '209', type: 'DULUXE', floor: floor2.id },
    { number: '210', type: 'SUPERIOR', floor: floor2.id },
    { number: '211', type: 'SUPERIOR', floor: floor2.id },
    { number: '212', type: 'SUPERIOR', floor: floor2.id },
    { number: '213', type: 'SUPERIOR', floor: floor2.id },
    { number: '214', type: 'SUPERIOR', floor: floor2.id },
    { number: '215', type: 'SUPERIOR', floor: floor2.id },
    { number: '216', type: 'DULUXE', floor: floor2.id },

    // Floor 3
    { number: '301', type: 'SUITE', floor: floor3.id },
    { number: '302', type: 'DULUXE', floor: floor3.id },
    { number: '303', type: 'STANDARD', floor: floor3.id },
    { number: '304', type: 'STANDARD', floor: floor3.id },
    { number: '305', type: 'STANDARD', floor: floor3.id },
    { number: '306', type: 'SUPERIOR', floor: floor3.id },
    { number: '307', type: 'SUITE', floor: floor3.id },
    { number: '308', type: 'SUPERIOR', floor: floor3.id },
    { number: '309', type: 'DULUXE', floor: floor3.id },
    { number: '310', type: 'SUPERIOR', floor: floor3.id },
    { number: '311', type: 'SUPERIOR', floor: floor3.id },
    { number: '312', type: 'SUPERIOR', floor: floor3.id },
    { number: '313', type: 'SUPERIOR', floor: floor3.id },
    { number: '314', type: 'SUPERIOR', floor: floor3.id },
    { number: '315', type: 'SUPERIOR', floor: floor3.id },
    { number: '316', type: 'DULUXE', floor: floor3.id },

    // Floor 4
    { number: '402', type: 'EXECUTIVE', floor: floor4.id },
    { number: '403', type: 'EXECUTIVE', floor: floor4.id },
    { number: '404', type: 'EXECUTIVE', floor: floor4.id },
  ];

  for (const r of roomsToCreate) {
    await prisma.room.create({
      data: {
        propertyId,
        buildingId: building.id,
        floorId: r.floor,
        roomTypeId: roomTypes[r.type],
        number: r.number,
        status: 'AVAILABLE',
        maxOccupancy: 2,
        bedConfiguration: '1 King Bed',
        housekeepingStatus: 'CLEAN'
      }
    });
  }

  console.log('Successfully seeded database with STANZEL 1 rooms!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

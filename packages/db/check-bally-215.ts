import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:postgres@localhost:5432/hotel_pms?schema=public'
});

async function main() {
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { name: { contains: 'bally', mode: 'insensitive' } },
        { code: { contains: 'bally', mode: 'insensitive' } }
      ]
    }
  });

  if (!property) {
    console.log("Property 'bally' not found.");
    return;
  }
  console.log(`Found property: ${property.name} (${property.code}) - ID: ${property.id}`);

  const room = await prisma.room.findFirst({
    where: {
      propertyId: property.id,
      number: '215'
    }
  });

  if (!room) {
    console.log("Room 215 not found in this property.");
    return;
  }
  console.log(`Found room 215: Status = ${room.status}, ID = ${room.id}`);

  // Find reservations for this room that might be causing it to show as occupied
  const reservationRooms = await prisma.reservationRoom.findMany({
    where: {
      roomId: room.id,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      reservation: {
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] }
      }
    },
    include: {
      reservation: true
    }
  });

  console.log(`Found ${reservationRooms.length} active reservations for this room.`);
  for (const rr of reservationRooms) {
    console.log(`Reservation ${rr.reservation.confirmationNumber}: checkIn=${rr.checkIn}, checkOut=${rr.checkOut}, status=${rr.reservation.status}, RR status=${rr.status}`);
  }

  // Also check folios to see if there is an active folio for this room
  const activeFolios = await prisma.folio.findMany({
    where: {
      roomId: room.id,
      status: 'OPEN'
    },
    include: {
      reservation: true
    }
  });
  console.log(`Found ${activeFolios.length} OPEN folios for this room.`);
  for (const f of activeFolios) {
    console.log(`Folio ${f.folioNumber}: Res ${f.reservation?.confirmationNumber}, Status=${f.status}`);
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const watermark = new Date();
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysFromNow = new Date(now); threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Rooms sent to the desktop (only active)
  const rooms = await prisma.room.findMany({
    where: { propertyId, isActive: true, updatedAt: { lte: watermark } }
  });
  const activeRoomIds = new Set(rooms.map(r => r.id));
  console.log(`Active rooms in payload: ${rooms.length}`);

  const resBaseWhere = {
    propertyId, deletedAt: null,
    OR: [
      { status: 'CHECKED_IN' },
      { status: 'CONFIRMED', checkIn: { lte: threeDaysFromNow, gte: yesterday } },
      { checkOut: { gte: yesterday, lte: threeDaysFromNow } }
    ]
  };
  
  const reservations = await prisma.reservation.findMany({
    where: { ...resBaseWhere, updatedAt: { lte: watermark } },
    include: {
      reservationRooms: { where: { status: 'ACTIVE' }, include: { room: true } }
    }
  });
  
  // The desktop derives roomId from flattened field: reservationRooms?.[0]?.roomId
  let errors = 0;
  for (const r of reservations) {
    const firstRoom = r.reservationRooms?.[0];
    const roomId = firstRoom?.roomId ?? null;
    if (roomId && !activeRoomIds.has(roomId)) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      console.log(`❌ Reservation ${r.id} (${r.status}) -> Room ${roomId} (number: ${room?.number}) isActive=${room?.isActive} - NOT included in payload!`);
      errors++;
    }
  }
  
  if (errors === 0) console.log("✅ All reservation roomIds match active rooms in the payload!");
  else console.log(`\n💥 Found ${errors} reservations with inactive/missing room references!`);
}
main().catch(console.error).finally(() => prisma.$disconnect());

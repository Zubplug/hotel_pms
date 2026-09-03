const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // The audit was run around 14:30 today
  const today = new Date();
  today.setHours(0,0,0,0);

  // Check PosSessions closed today
  const closedPos = await prisma.posSession.findMany({
      where: {
          status: 'CLOSED',
          closedAt: { gte: today }
      }
  });

  console.log(`Found ${closedPos.length} POS sessions closed today.`);
  for (const s of closedPos) {
      console.log(`- POS Session ${s.id} (Ref: ${s.shiftReference}) closed at ${s.closedAt}`);
  }

  // Check for Room status updates (if we can track it, usually we can't easily track room status changes without an audit log)
  // Let's just check how many rooms are currently DIRTY vs CLEAN
  const cleanRooms = await prisma.room.count({ where: { housekeepingStatus: 'CLEAN' } });
  const dirtyRooms = await prisma.room.count({ where: { housekeepingStatus: 'DIRTY' } });
  console.log(`\nCurrent Room Statuses: ${cleanRooms} CLEAN, ${dirtyRooms} DIRTY`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

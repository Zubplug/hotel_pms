const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sep2 = new Date('2026-09-02T00:00:00.000Z');

  const session = await prisma.frontdeskSession.findUnique({
    where: { shiftReference: 'FD-20260902-689AA27C' }
  });

  if (!session) { console.log('Session not found.'); return; }
  console.log(`Before: Business Date = ${session.businessDate.toDateString()}`);

  await prisma.frontdeskSession.update({
    where: { id: session.id },
    data: {
      businessDate: sep2,
      updatedAt: new Date()
    }
  });

  const updated = await prisma.frontdeskSession.findUnique({ where: { id: session.id } });
  console.log(`✅ After:  Business Date = ${updated.businessDate.toDateString()}`);
  console.log(`✅ Shift: ${updated.shiftReference} | Staff: ${session.staffId} | Status: ${updated.status}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

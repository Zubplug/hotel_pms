const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetShiftRef = 'FD-20260902-689AA27C';
  const targetShift = await prisma.frontdeskSession.findUnique({
      where: { shiftReference: targetShiftRef }
  });

  if (!targetShift) {
      console.log(`Shift ${targetShiftRef} not found`);
      return;
  }

  const unlinkedPaymentIds = [
      '0e06fc74-2a5f-48bb-947d-404f4418c197',
      '8b1b0ec8-0503-4c39-9899-1199d4dcff15'
  ];

  await prisma.payment.updateMany({
      where: { id: { in: unlinkedPaymentIds } },
      data: { frontdeskSessionId: targetShift.id }
  });

  console.log(`✅ Successfully linked the 2 missing advance deposits to shift ${targetShiftRef}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

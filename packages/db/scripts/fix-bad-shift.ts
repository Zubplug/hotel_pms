import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badSessionId = 'ac1202f3-616e-439a-aae4-990d9a7e68e3';

  // 1. Get the session to find the propertyId
  const badSession = await prisma.frontdeskSession.findUnique({
    where: { id: badSessionId }
  });

  if (!badSession) {
    console.log("Session not found!");
    return;
  }

  // 2. Find a valid Frontdesk Till at the same property
  const validTill = await prisma.cashAccount.findFirst({
    where: {
      propertyId: badSession.propertyId,
      type: 'FRONTDESK_TILL',
      isActive: true
    },
    orderBy: { name: 'asc' } // Will pick Frontdesk Till 1
  });

  if (!validTill) {
    console.log("No valid Frontdesk Till found at this property to swap to!");
    return;
  }

  // 3. Reassign the session
  await prisma.frontdeskSession.update({
    where: { id: badSessionId },
    data: { cashAccountId: validTill.id }
  });

  console.log(`Successfully reassigned Shift for Staff from Cash in Transit to ${validTill.name} (${validTill.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

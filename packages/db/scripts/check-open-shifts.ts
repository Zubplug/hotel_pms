import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const openSessions = await prisma.frontdeskSession.findMany({
    where: { status: 'OPEN' },
    include: {
      cashAccount: true,
      staff: true
    }
  });

  console.log(`Found ${openSessions.length} OPEN Frontdesk Sessions.`);

  for (const session of openSessions) {
    console.log(`- Session ID: ${session.id}`);
    console.log(`  Staff: ${session.staff.firstName} ${session.staff.lastName}`);
    console.log(`  Cash Account: ${session.cashAccount.name} (Type: ${session.cashAccount.type})`);
    
    if (session.cashAccount.type !== 'FRONTDESK_TILL') {
      console.log(`  >>> WARNING: This shift is linked to an invalid account type!`);
    }
    console.log('---------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

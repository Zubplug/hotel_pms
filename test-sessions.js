const { PrismaClient } = require('./packages/db');
const prisma = new PrismaClient();

async function main() {
  const sessionIds = [
    '5bc19b3b-3b47-49b0-b016-f24c563b2d64',
    '7f9c34a3-0683-4d73-9058-e78710881d13',
    '47ad9b37-14a9-4c46-832b-372eccd5bf56',
    '96ce3883-f1f1-4057-9434-2d502922fec9'
  ];

  const sessions = await prisma.posSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      status: true,
      businessDate: true,
      openedBy: true,
      expectedCash: true
    }
  });
  console.log("Sessions linked to open orders:", sessions);
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.posPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log(JSON.stringify(latestPayments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

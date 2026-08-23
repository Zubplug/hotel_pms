const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestPayments = await prisma.posPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      order: true
    }
  });

  for (const payment of latestPayments) {
    console.log(`Payment: ${payment.id}, amount: ${payment.amount}, sessionId: ${payment.sessionId}`);
    if (payment.sessionId) {
       const session = await prisma.posSession.findUnique({ where: { id: payment.sessionId }});
       const opSession = await prisma.posOperatorSession.findUnique({ where: { id: payment.sessionId }});
       console.log(` -> Found in PosSession: ${!!session}, Found in PosOperatorSession: ${!!opSession}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

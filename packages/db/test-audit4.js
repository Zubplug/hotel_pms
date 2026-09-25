const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const recentAudits = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Most recent audits overall:");
  console.log(JSON.stringify(recentAudits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

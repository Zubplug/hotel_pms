const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const auditId = 'd1ce997e-edba-4c83-b63c-21a23db4c69f';

  const items = await prisma.folioItem.findMany({
      where: { nightAuditRunId: auditId },
      select: { id: true, description: true, amount: true, type: true }
  });

  console.log(`Found ${items.length} Folio Items posted by this audit.`);
  for (const item of items) {
      console.log(`- [${item.type}] ${item.description}: ${item.amount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

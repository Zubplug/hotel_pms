import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.financialAuditLog.findMany({
    where: { 
      operationType: 'CREDIT_APPLICATION',
      idempotencyKey: { startsWith: 'audit:CREDIT_APPLICATION:' }
    }
  });
  
  let dangling = 0;
  for (const log of logs) {
    const appKey = log.idempotencyKey.replace('audit:', '');
    const app = await prisma.folioCreditApplication.findUnique({
      where: { idempotencyKey: appKey }
    });
    if (!app) {
      console.log(`Dangling log found: ${log.id}, key: ${log.idempotencyKey}`);
      dangling++;
      // Uncomment to fix:
      // await prisma.financialAuditLog.delete({ where: { id: log.id } });
    }
  }
  console.log(`Found ${dangling} dangling logs.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

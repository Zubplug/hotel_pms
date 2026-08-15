import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(logs.map(l => ({ action: l.action, prev: l.previousValue, next: l.newValue })));
}
main();

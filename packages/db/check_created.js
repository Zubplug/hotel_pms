const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.notification.count();
  console.log('Total notifications in DB: ' + count);
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(notifications, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

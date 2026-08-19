const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`Total notifications: ${notifications.length}`);
  console.log(JSON.stringify(notifications, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

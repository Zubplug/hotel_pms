const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const notifications = await prisma.notification.findMany({
    where: { channel: 'in_app' },
    select: {
      id: true,
      subject: true,
      body: true,
      category: true,
      priority: true,
      recipientId: true,
      createdAt: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(notifications, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

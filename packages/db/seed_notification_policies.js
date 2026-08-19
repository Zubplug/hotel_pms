const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const properties = await prisma.property.findMany({ select: { id: true, settings: true } });
  for (const prop of properties) {
    const settings = (prop.settings || {})
    settings.notificationPolicy = {
      largePaymentThreshold: 1000000,
      highValueRefundThreshold: 100000,
      cashVarianceThreshold: 50000,
    };
    await prisma.property.update({
      where: { id: prop.id },
      data: { settings: settings }
    });
  }
  console.log('Notification policies seeded successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());

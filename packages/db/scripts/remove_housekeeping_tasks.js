const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return;

  // The audit was run around 14:30 GMT+0100 today
  const today = new Date();
  today.setHours(0,0,0,0);

  const tasks = await prisma.housekeepingTask.findMany({
      where: {
          propertyId: property.id,
          createdAt: { gte: today }
      }
  });

  if (tasks.length === 0) {
      console.log("No housekeeping tasks found created today.");
  } else {
      console.log(`Found ${tasks.length} housekeeping tasks created today. Deleting them...`);
      await prisma.housekeepingTask.deleteMany({
          where: {
              propertyId: property.id,
              createdAt: { gte: today }
          }
      });
      console.log(`✅ Deleted ${tasks.length} housekeeping tasks.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

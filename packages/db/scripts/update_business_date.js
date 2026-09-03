const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  if (!property) {
      console.log("Stanzel property not found");
      return;
  }
  
  // Set to September 1, 2026 (UTC midnight)
  const targetDate = new Date('2026-09-01T00:00:00.000Z');

  await prisma.property.update({
      where: { id: property.id },
      data: { businessDate: targetDate }
  });

  console.log(`✅ Business date for ${property.name} forcefully updated to ${targetDate.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return;

  const audit = await prisma.nightAudit.findUnique({
      where: { id: 'd1ce997e-edba-4c83-b63c-21a23db4c69f' }
  });

  if (audit) {
      await prisma.nightAudit.delete({
          where: { id: audit.id }
      });
      console.log(`✅ Deleted Night Audit record for ${audit.businessDate}`);
  }

  // Revert property business date to August 26, 2026
  const targetDate = new Date('2026-08-26T00:00:00.000Z');
  await prisma.property.update({
      where: { id: property.id },
      data: { businessDate: targetDate }
  });
  console.log(`✅ Reverted property business date back to ${targetDate.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

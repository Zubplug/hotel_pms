const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });

  // 1. Delete ALL existing NightAudit records for this property (demo/test runs)
  const deleted = await prisma.nightAudit.deleteMany({ where: { propertyId: property.id } });
  console.log(`🗑️  Deleted ${deleted.count} old NightAudit records`);

  // 2. Set business date to Sep 1, 2026 (production start day) with OPEN status
  const businessDate = new Date('2026-09-01T00:00:00.000Z');
  await prisma.property.update({
    where: { id: property.id },
    data: {
      businessDate: businessDate,
      auditStatus: 'OPEN',
      updatedAt: new Date()
    }
  });

  console.log(`✅ Business date set to: 2026-09-01 (Sep 1, 2026)`);
  console.log(`✅ Audit status set to: OPEN`);
  console.log(`✅ All old/demo audit records cleared`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

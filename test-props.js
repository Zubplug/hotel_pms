const { PrismaClient } = require('./packages/db');
const prisma = new PrismaClient();

async function main() {
  const props = await prisma.property.findMany({ select: { id: true, name: true, businessDate: true } });
  console.log("Properties:", props);
  for (const p of props) {
      const openSessions = await prisma.posSession.findMany({
          where: { propertyId: p.id, status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] } },
          select: { id: true, status: true, businessDate: true, openedBy: true }
      });
      console.log(`Open sessions for ${p.name}:`, openSessions);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

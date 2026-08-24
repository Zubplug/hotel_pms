import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const terminal = await prisma.posTerminal.findFirst({
    orderBy: { registeredAt: 'desc' },
    include: { outlet: { include: { property: true } } }
  });
  if (terminal) {
    console.log(`Latest Terminal: ${terminal.name} (${terminal.terminalCode})`);
    console.log(`Property ID: ${terminal.propertyId}`);
    console.log(`Property Name: ${terminal.outlet?.property?.name || 'Unknown'}`);
  } else {
    console.log('No terminals found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

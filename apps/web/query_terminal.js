const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const terminal = await prisma.posTerminal.findFirst({
    orderBy: { registeredAt: 'desc' }
  });
  if (terminal) {
    console.log(`Latest Terminal: ${terminal.name} (${terminal.terminalCode})`);
    console.log(`Property ID: ${terminal.propertyId}`);
    console.log(`Outlet ID: ${terminal.outletId}`);
  } else {
    console.log('No terminals found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

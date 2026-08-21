const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const terminals = await prisma.posTerminal.findMany();
  console.log(JSON.stringify(terminals, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

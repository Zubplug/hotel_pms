const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const f = await prisma.folio.findFirst({ include: { items: true } });
  console.log(JSON.stringify(f));
}
main().catch(console.error).finally(() => prisma.$disconnect());

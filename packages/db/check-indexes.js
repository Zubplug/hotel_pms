const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'PosSession';
  `;
  console.log(indexes);
}
main().catch(console.error).finally(() => prisma.$disconnect());

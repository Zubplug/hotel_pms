const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const constraints = await prisma.$queryRaw`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'PosSession';
  `;
  console.log(constraints);
}
main().catch(console.error).finally(() => prisma.$disconnect());

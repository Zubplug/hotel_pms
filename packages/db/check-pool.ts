import { PrismaClient } from '@hotel-pms/db';
const prisma = new PrismaClient();

async function main() {
  const outlets = await prisma.posOutlet.findMany({
    select: { id: true, name: true, type: true }
  });
  console.log(outlets);
}

main().catch(console.error).finally(() => prisma.$disconnect());

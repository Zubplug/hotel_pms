import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ev = await prisma.hotelEvent.findFirst({
    where: { aggregateId: '602830d8-2abf-40ff-b1c7-6ab63230a33f' }
  });
  console.dir(ev, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());

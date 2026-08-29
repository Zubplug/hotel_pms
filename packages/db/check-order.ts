import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.posOrder.findUnique({
    where: { id: '602830d8-2abf-40ff-b1c7-6ab63230a33f' }
  });
  console.dir(order);
}
main().catch(console.error).finally(() => prisma.$disconnect());

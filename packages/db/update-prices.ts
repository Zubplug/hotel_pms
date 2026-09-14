import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.posProduct.updateMany({
    where: { name: 'Adult Pool Pass — Day' },
    data: { price: 1000 }
  });
  await prisma.posProduct.updateMany({
    where: { name: 'Child Pool Pass — Day' },
    data: { price: 500 }
  });
  console.log("Prices updated successfully.");
}
main().catch(console.error).finally(() => prisma.$disconnect());

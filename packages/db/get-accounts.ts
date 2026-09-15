import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046'; // Property ID
  const accounts = await prisma.chartOfAccount.findMany({
    where: { propertyId },
    select: { id: true, code: true, name: true, type: true }
  });
  for (const acc of accounts) {
    console.log(`[${acc.code}] ${acc.name} (${acc.type}) -> ${acc.id}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

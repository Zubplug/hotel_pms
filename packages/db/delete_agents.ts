import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.hardwareAgent.deleteMany();
  console.log("Deleted all agents");
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@hotel-pms/db');
const prisma = new PrismaClient();
async function run() {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { propertyId: '9b8a4229-4059-42f4-9565-51cfdbe79046' }, // Stanzel Grand Resort
    select: { code: true, name: true, type: true }
  });
  console.log(accounts.sort((a,b) => a.code.localeCompare(b.code)));
}
run().catch(console.error).finally(() => prisma.$disconnect());

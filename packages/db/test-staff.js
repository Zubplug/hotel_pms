const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const staffList = await prisma.staff.findMany();
  console.log('Staff list:', JSON.stringify(staffList, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staffList = await prisma.staff.findMany({
    where: { 
      OR: [
        { email: { contains: 'esther' } },
        { firstName: { contains: 'esther', mode: 'insensitive' } },
        { email: 'fridayekunke@gmail.com' },
        { email: 'ogechinweke@gmail.com' }
      ]
    },
    include: {
      outletAccess: true
    }
  });
  console.dir(staffList, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());

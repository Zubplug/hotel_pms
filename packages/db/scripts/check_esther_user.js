const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const esther = await prisma.user.findFirst({
    where: { email: 'bassyesther0526@gmail.com' },
    include: {
      roles: {
        include: { role: true }
      },
      staff: true
    }
  });
  console.dir(esther, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());

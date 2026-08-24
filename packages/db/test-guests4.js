const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.guest.findMany({
    orderBy: [
      { updatedAt: 'asc' },
      { id: 'asc' }
    ]
  });
  console.log(JSON.stringify(guests.map(g => ({ id: g.id, firstName: g.firstName, updatedAt: g.updatedAt })), null, 2));
}
main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.guest.findMany();
  console.log(JSON.stringify(guests.map(g => ({ id: g.id, firstName: g.firstName, deletedAt: g.deletedAt })), null, 2));
}
main().finally(() => prisma.$disconnect());

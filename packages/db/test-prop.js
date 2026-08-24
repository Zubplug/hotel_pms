const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const props = await prisma.property.findMany();
  console.log(JSON.stringify(props.map(p => ({ id: p.id, org: p.organizationId })), null, 2));
}
main().finally(() => prisma.$disconnect());

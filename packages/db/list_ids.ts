import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst();
  console.log('Property ID:', property?.id);

  const outlet = await prisma.posOutlet.findFirst();
  console.log('Outlet ID:', outlet?.id, 'Type:', outlet?.type);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

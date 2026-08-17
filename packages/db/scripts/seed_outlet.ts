import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst();
  if (!property) {
    console.error('No property found!');
    process.exit(1);
  }

  let outlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id }
  });

  if (!outlet) {
    outlet = await prisma.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'Main Restaurant',
        type: 'RESTAURANT',
        isActive: true
      }
    });
    console.log(`Created POS Outlet: ${outlet.name}`);
  } else {
    console.log(`POS Outlet already exists: ${outlet.name}`);
  }

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // or bcrypt
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return console.log("Property not found");

  const poolBar = await prisma.posOutlet.findFirst({ where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - POOL BAR' } });
  if (!poolBar) return console.log("Pool Bar outlet not found");

  const org = await prisma.organization.findFirst();

  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const posPinHash = await bcrypt.hash(pin, 10);

  const staff = await prisma.staff.create({
    data: {
      organizationId: org.id,
      firstName: 'Friday',
      lastName: 'Ekunke',
      email: 'fridayekunke@gmail.com',
      department: 'F&B',
      position: 'WAITER',
      propertyAccess: [property.id],
      isActive: true,
      posPinHash: posPinHash,
      hiredAt: new Date()
    }
  });

  await prisma.staffPosOutletAccess.create({
    data: {
      staffId: staff.id,
      outletId: poolBar.id
    }
  });

  console.log(`Waiter created successfully!`);
  console.log(`Name: Friday Ekunke`);
  console.log(`Email: fridayekunke@gmail.com`);
  console.log(`PIN: ${pin}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return console.log("Property not found");

  const poolBar = await prisma.posOutlet.findFirst({ where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - POOL BAR' } });
  if (!poolBar) return console.log("Pool Bar outlet not found");

  const waiterRole = await prisma.role.findFirst({ where: { name: 'WAITER' } });
  
  const email = 'kingsley71@gmail.com';
  
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const posPinHash = await bcrypt.hash(pin, 10);
  const defaultPassword = await bcrypt.hash('password123', 10);

  // 1. Create Web User
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: defaultPassword
      }
    });
  }

  // 2. Create Staff
  let staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        organizationId: property.organizationId,
        userId: user.id,
        firstName: 'Kingsley',
        lastName: 'Eyo',
        email: email,
        department: 'F&B',
        position: 'WAITER',
        propertyAccess: [property.id],
        isActive: true,
        posPinHash: posPinHash,
        hiredAt: new Date()
      }
    });
  }

  // 3. Outlet Access
  const access = await prisma.staffPosOutletAccess.findFirst({
    where: { staffId: staff.id, outletId: poolBar.id }
  });
  if (!access) {
    await prisma.staffPosOutletAccess.create({
      data: {
        staffId: staff.id,
        outletId: poolBar.id
      }
    });
  }
  
  // 4. Role Mapping
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: waiterRole.id, propertyId: property.id }
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: waiterRole.id,
        propertyId: property.id,
        grantedBy: user.id
      }
    });
  }

  console.log(`Waiter created successfully!`);
  console.log(`Name: Kingsley Eyo`);
  console.log(`Email: kingsley71@gmail.com`);
  console.log(`PIN: ${pin}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
